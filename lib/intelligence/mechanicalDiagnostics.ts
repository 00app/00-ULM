/**
 * Mechanical Truth diagnostics — shared checks for Settings Flight Deck + Zone strip.
 * Binds to GET /api/health, GET /api/health/diagnostics, scrape-sync, local-intelligence.
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

  let apiGemini = false
  let apiFirecrawl = false
  let apiAiGateway = false
  let apiAiGatewayOk = false
  let apiAiGatewayDetail: string | null = null
  let dbLatencyMs: number | null = null

  try {
    const res = await fetch('/api/health/diagnostics', { cache: 'no-store' })
    if (res.ok) {
      const d = (await res.json()) as {
        gemini?: boolean
        firecrawl?: boolean
        aiGateway?: boolean
        aiGatewayOk?: boolean
        aiGatewayDetail?: string | null
        dbLatencyMs?: number | null
        neon?: boolean
      }
      apiGemini = Boolean(d.gemini)
      apiFirecrawl = Boolean(d.firecrawl)
      apiAiGateway = Boolean(d.aiGateway)
      apiAiGatewayOk = Boolean(d.aiGatewayOk)
      apiAiGatewayDetail =
        typeof d.aiGatewayDetail === 'string' && d.aiGatewayDetail.trim()
          ? d.aiGatewayDetail.trim()
          : null
      if (typeof d.dbLatencyMs === 'number' && Number.isFinite(d.dbLatencyMs)) {
        dbLatencyMs = d.dbLatencyMs
      }
      if (d.neon === false) params = { ...params, dbConnected: false }
    }
  } catch {
    /* keep defaults */
  }

  let liveLocalOk = Boolean(params.localityLabel?.trim())
  let gridDetail = params.localityLabel?.trim() ?? ''
  if (pc.length >= 4) {
    try {
      const res = await fetch(`/api/local-intelligence?postcode=${encodeURIComponent(pc)}`, {
        cache: 'no-store',
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
  if (pc.length >= 4) {
    try {
      const res = await fetch(
        appendResearchUserIdQuery(`/api/scrape-sync?postcode=${encodeURIComponent(pc)}`),
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        meta = parseResearchMetaFromApi(data)
        coverage = parseCoverageFromApi(data)
      }
    } catch {
      /* non-blocking */
    }
  }

  const ticks = researchTicksFromPayload(meta, coverage)
  const covRows = coverage ? Object.values(coverage) : []
  const pipelineOk = ticks.moneyOk && ticks.proseOk && ticks.offerOk
  const injectReady = covRows.some((c) => c.insightReady && c.hasOffer)

  const neonDetail = params.dbConnected
    ? `${neonRegionLabel()}${dbLatencyMs != null ? ` · ${Math.round(dbLatencyMs)}ms` : ''}`
    : params.dbHealthHint?.trim() || 'GET /api/health failed'

  const gatewayDetail = !apiAiGateway
    ? 'Direct Gemini (GATEWAY_TOKEN optional)'
    : apiAiGatewayOk
      ? 'Authorization: GATEWAY_TOKEN'
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

  return [
    {
      id: 'neon',
      component: 'NEON DATABASE',
      ok: params.dbConnected,
      detail: neonDetail,
    },
    {
      id: 'gemini',
      component: 'GEMINI API',
      ok: apiGemini,
      detail: apiGemini ? '1.5 Flash (Surgical Mode)' : 'GEMINI_API_KEY unset',
    },
    {
      id: 'firecrawl',
      component: 'FIRECRAWL API',
      ok: apiFirecrawl,
      detail: apiFirecrawl ? 'Seed Matrix Active' : 'FIRE_CRAWL_KEY_2 unset',
    },
    {
      id: 'gateway',
      component: 'AI GATEWAY',
      ok: apiGemini && (!apiAiGateway || apiAiGatewayOk),
      detail: gatewayDetail,
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
  ]
}
