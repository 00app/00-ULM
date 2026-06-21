/**
 * Mechanical Truth diagnostics — shared checks for Settings Flight Deck + Zone strip.
 * Binds to GET /api/health (provider flags), GET /api/health/diagnostics (session),
 * GET /api/scrape-sync, GET /api/local-intelligence.
 */

import { MANIFEST_NEON_POOLER_HOST } from '@/lib/intelligence/manifest'
import { appendResearchUserIdQuery } from '@/lib/zone/garyMode'
import {
  parseCoverageFromApi,
  parseResearchMetaFromApi,
  researchTicksFromPayload,
} from '@/lib/zone/parseScrapeSyncClient'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'

export type MechanicalDiagnosticRow = {
  id: string
  component: string
  ok: boolean
  detail: string
}

export type MechanicalDiagnosticsSnapshot = {
  rows: MechanicalDiagnosticRow[]
  allOk: boolean
  loading: boolean
}

type HealthProviders = {
  gemini?: boolean
  firecrawl?: boolean
  firecrawlEnv?: string | null
  skipFirecrawl?: boolean
  geminiZoneModel?: string
  bucketFailover?: boolean
  researchForceDirectGemini?: boolean
}

function outwardPostcode(pc: string): string {
  const m = pc.replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)
  return m?.[1] ?? pc.slice(0, 4).toUpperCase()
}

function neonRegionLabel(): string {
  const host = MANIFEST_NEON_POOLER_HOST
  const region = host.includes('eu-west-2') ? 'eu-west-2' : host.split('.').slice(-4, -3)[0] ?? 'pooler'
  return `London ${region}`
}

export async function pollMechanicalDiagnostics(params: {
  dbConnected: boolean
  dbHealthHint?: string | null
  scrapePostcode?: string
  localityLabel?: string
}): Promise<MechanicalDiagnosticRow[]> {
  const pc = (params.scrapePostcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  const outward = pc.length >= 4 ? outwardPostcode(pc) : ''

  let dbConnected = params.dbConnected
  let dbHealthHint = params.dbHealthHint?.trim() || null
  let apiGemini = false
  let apiFirecrawl = false
  let skipFirecrawl = false
  let firecrawlEnv: string | null = null
  let geminiZoneModel = 'gemini-2.5-flash'
  let bucketFailover = false
  let researchForceDirect = true
  let apiAiGateway = false
  let apiAiGatewayOk = false
  let apiAiGatewayDetail: string | null = null
  let dbLatencyMs: number | null = null
  let lastResearchScrapedAt: string | null = null

  try {
    const res = await fetch('/api/health', { cache: 'no-store', credentials: 'include' })
    const h = (await res.json().catch(() => null)) as {
      status?: string
      database?: string
      error?: string
      hint?: string
      providers?: HealthProviders
      latencyMs?: number
    } | null
    if (res.ok && h?.status === 'ok' && h.database === 'connected') {
      dbConnected = true
      dbHealthHint = null
    } else if (h?.database === 'not_configured') {
      dbConnected = false
      dbHealthHint =
        typeof h.hint === 'string' && h.hint.trim()
          ? h.hint.trim()
          : 'DATABASE_URL not configured — run vercel pull and copy to .env.local'
    } else if (!res.ok) {
      dbConnected = false
      dbHealthHint =
        typeof h?.error === 'string' && h.error.trim()
          ? h.error.trim()
          : `GET /api/health → HTTP ${res.status}`
    }
    if (h?.providers) {
      const p = h.providers
      apiGemini = Boolean(p.gemini)
      apiFirecrawl = Boolean(p.firecrawl)
      skipFirecrawl = Boolean(p.skipFirecrawl)
      firecrawlEnv =
        typeof p.firecrawlEnv === 'string' && p.firecrawlEnv.trim() ? p.firecrawlEnv.trim() : null
      if (typeof p.geminiZoneModel === 'string' && p.geminiZoneModel.trim()) {
        geminiZoneModel = p.geminiZoneModel.trim()
      }
      bucketFailover = Boolean(p.bucketFailover)
      researchForceDirect = p.researchForceDirectGemini !== false
    }
    if (typeof h?.latencyMs === 'number' && Number.isFinite(h.latencyMs)) {
      dbLatencyMs = h.latencyMs
    }
  } catch {
    dbConnected = false
    dbHealthHint = dbHealthHint ?? 'Network error calling /api/health'
  }

  try {
    const res = await fetch('/api/health/diagnostics', {
      cache: 'no-store',
      credentials: 'include',
    })
    if (res.ok) {
      const d = (await res.json()) as {
        gemini?: boolean
        firecrawl?: boolean
        aiGateway?: boolean
        aiGatewayOk?: boolean
        aiGatewayDetail?: string | null
        dbLatencyMs?: number | null
        neon?: boolean
        lastResearchScrapedAt?: string | null
        bucket_failover?: { enabled?: boolean }
      }
      if (d.gemini === true) apiGemini = true
      if (d.firecrawl === true && !skipFirecrawl) apiFirecrawl = true
      apiAiGateway = Boolean(d.aiGateway)
      apiAiGatewayOk = Boolean(d.aiGatewayOk)
      apiAiGatewayDetail =
        typeof d.aiGatewayDetail === 'string' && d.aiGatewayDetail.trim()
          ? d.aiGatewayDetail.trim()
          : null
      if (typeof d.dbLatencyMs === 'number' && Number.isFinite(d.dbLatencyMs)) {
        dbLatencyMs = d.dbLatencyMs
      }
      if (d.neon === true) dbConnected = true
      if (d.neon === false) dbConnected = false
      if (typeof d.lastResearchScrapedAt === 'string' && d.lastResearchScrapedAt.trim()) {
        lastResearchScrapedAt = d.lastResearchScrapedAt.trim()
      }
      if (d.bucket_failover?.enabled === true) bucketFailover = true
    }
  } catch {
    /* session diagnostics optional */
  }

  let liveLocalOk = Boolean(params.localityLabel?.trim())
  let gridDetail = params.localityLabel?.trim() ?? ''
  if (pc.length >= 4) {
    try {
      const res = await fetch(`/api/local-intelligence?postcode=${encodeURIComponent(pc)}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (res.ok) {
        const data = (await res.json()) as { locality?: string; council?: string; localCarbonG?: number }
        const loc = [data.locality, data.council].filter(Boolean).join(', ')
        if (loc.trim()) {
          liveLocalOk = true
          gridDetail = loc.trim()
        }
        if (typeof data.localCarbonG === 'number' && Number.isFinite(data.localCarbonG)) {
          liveLocalOk = true
          gridDetail = gridDetail
            ? `${gridDetail} · grid ${data.localCarbonG} g/kWh`
            : `grid ${data.localCarbonG} g/kWh`
        }
      }
    } catch {
      /* non-blocking */
    }
  }

  let meta = null
  let coverage: Record<string, ResearchCategoryCoverageRow> | null = null
  let scrapeSyncOk = false
  let scrapeSource: string | null = null
  if (pc.length >= 4) {
    try {
      const res = await fetch(
        appendResearchUserIdQuery(`/api/scrape-sync?postcode=${encodeURIComponent(pc)}`),
        { cache: 'no-store', credentials: 'include' }
      )
      scrapeSyncOk = res.ok
      if (res.ok) {
        const data = await res.json()
        meta = parseResearchMetaFromApi(data)
        coverage = parseCoverageFromApi(data)
        const src = (data as { source?: string }).source
        scrapeSource = typeof src === 'string' ? src : null
      }
    } catch {
      /* non-blocking */
    }
  }

  const ticks = researchTicksFromPayload(meta, coverage)
  const covRows = coverage ? Object.values(coverage) : []
  const pipelineOk = ticks.moneyOk && ticks.proseOk && ticks.offerOk
  const injectReady = covRows.some((c) => c.insightReady && c.hasOffer)
  const categoriesReady = covRows.filter((c) => c.insightReady).length

  const neonDetail = dbConnected
    ? `${neonRegionLabel()}${dbLatencyMs != null ? ` · ${Math.round(dbLatencyMs)}ms` : ''}`
    : dbHealthHint ?? 'GET /api/health failed'

  const geminiDetail = apiGemini
    ? `${geminiZoneModel} · GEMINI_API_KEY set`
    : 'GEMINI_API_KEY unset — add to .env.local and restart dev'

  const firecrawlDetail = skipFirecrawl
    ? 'SKIP_FIRECRAWL=1 — Firecrawl off (mechanical + Neon only)'
    : apiFirecrawl
      ? `Seed matrix · ${firecrawlEnv ?? 'Firecrawl key'}`
      : 'Unset — FIRE_CRAWL_KEY_3 → KEY_2 → FIRECRAWL_API_KEY'

  const gatewayDetail = !apiAiGateway
    ? researchForceDirect
      ? 'Research: direct Gemini · GATEWAY_TOKEN optional for agents'
      : 'Direct Gemini (GATEWAY_TOKEN optional)'
    : apiAiGatewayOk
      ? 'Vercel AI Gateway · GATEWAY_TOKEN or session'
      : apiAiGatewayDetail ?? 'Gateway probe pending'

  const localityDetail =
    liveLocalOk && outward
      ? `Postcode resolved: ${outward}${gridDetail ? ` · ${gridDetail}` : ''}`
      : pc.length >= 4
        ? 'Resolving locality…'
        : 'Set postcode in profile'

  const moneyDetail =
    ticks.moneyHint ??
    (ticks.moneyOk ? 'saving_amount_gbp > 0' : 'Awaiting surgical scrape')

  const bucketDetail = bucketFailover
    ? 'MODEL_STRATEGY=bucket_failover · Groq/Mistral/OpenRouter chain'
    : 'Direct Gemini + Firecrawl (default)'

  const scrapeDetail = !pc.length
    ? 'Set postcode in profile'
    : scrapeSyncOk
      ? scrapeSource === 'pending'
        ? 'GET ok · Neon empty — JIT scrape on Tip +1'
        : `GET ok · ${categoriesReady} categor${categoriesReady === 1 ? 'y' : 'ies'} in coverage`
      : 'GET failed — check session or dev server'

  const loopDetail = lastResearchScrapedAt
    ? `Last Neon row · ${new Date(lastResearchScrapedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`
    : pipelineOk
      ? 'Firecrawl → Gemini triplet → Neon research_results'
      : 'Earned on Tip +1 · weekly cron · Hermes repair'

  return [
    {
      id: 'neon',
      component: 'NEON DATABASE',
      ok: dbConnected,
      detail: neonDetail,
    },
    {
      id: 'gemini',
      component: 'GEMINI API',
      ok: apiGemini,
      detail: geminiDetail,
    },
    {
      id: 'firecrawl',
      component: 'FIRECRAWL API',
      ok: apiFirecrawl || skipFirecrawl,
      detail: firecrawlDetail,
    },
    {
      id: 'gateway',
      component: 'AI GATEWAY',
      ok: apiGemini && (!apiAiGateway || apiAiGatewayOk),
      detail: gatewayDetail,
    },
    {
      id: 'bucket',
      component: 'MODEL STRATEGY',
      ok: apiGemini || bucketFailover,
      detail: bucketDetail,
    },
    {
      id: 'scrape',
      component: 'SCRAPE-SYNC',
      ok: scrapeSyncOk,
      detail: scrapeDetail,
    },
    {
      id: 'money',
      component: 'RESEARCH £ ROW',
      ok: ticks.moneyOk,
      detail: moneyDetail,
    },
    {
      id: 'locality',
      component: 'LOCALITY + GRID',
      ok: liveLocalOk,
      detail: localityDetail,
    },
    {
      id: 'prose',
      component: 'ARCHITECT PROSE',
      ok: ticks.proseOk,
      detail: ticks.proseOk ? '3-Paragraph Triplet Valid' : 'architect_prose pending',
    },
    {
      id: 'offer',
      component: 'OFFER URL',
      ok: ticks.offerOk,
      detail: ticks.offerOk ? 'Primary Handoff Verified' : 'offer_url pending',
    },
    {
      id: 'tip',
      component: 'TRUE TIP ROW',
      ok: pipelineOk || injectReady,
      detail: pipelineOk ? 'Discovery pipeline live' : injectReady ? 'Category insight ready' : 'Tip +1 earns scrape',
    },
    {
      id: 'loop',
      component: 'INTELLIGENCE LOOP',
      ok: pipelineOk || Boolean(lastResearchScrapedAt),
      detail: loopDetail,
    },
  ]
}
