import { NextRequest, NextResponse } from 'next/server'
import pool, { pingDatabase } from '@/lib/db'
import { ROCK_HABIT_COUNT, ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import { getSessionFromRequest } from '@/lib/auth'
import {
  getGatewayHealthSnapshot,
  hasAiGatewayApiKey,
  isAiGatewayConfigured,
  probeAiGatewayConnection,
} from '@/lib/intelligence/aiGateway'

export const dynamic = 'force-dynamic'

/**
 * Server-side nervous-system checks (no secret values exposed — booleans + timestamps only).
 */
function hasGatewayAuth(request: NextRequest): boolean {
  const expected = process.env.GATEWAY_TOKEN?.trim() || process.env.CRON_SECRET?.trim()
  if (!expected) return false
  const got =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim() ??
    request.headers.get('x-gateway-token')?.trim()
  return got === expected
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  const authed = Boolean(session) || hasGatewayAuth(request)

  let neonOk = false
  let dbLatencyMs: number | null = null
  let lastResearchScrapedAt: string | null = null

  const dbPing = await pingDatabase()
  neonOk = dbPing.ok
  dbLatencyMs = dbPing.latencyMs

  try {
    const r = await pool.query<{ t: Date | string | null }>(
      `SELECT MAX(created_at) AS t FROM research_results`
    )
    const t = r.rows[0]?.t
    if (t) {
      const d = t instanceof Date ? t : new Date(t)
      lastResearchScrapedAt = Number.isNaN(d.getTime()) ? null : d.toISOString()
    }
  } catch {
    lastResearchScrapedAt = null
  }

  let researchProvenanceUrl: string | null = null
  try {
    const pr = await pool.query<{ source_url: string | null }>(
      `SELECT source_url FROM research_results ORDER BY created_at DESC NULLS LAST LIMIT 1`
    )
    const u = pr.rows[0]?.source_url?.trim()
    researchProvenanceUrl = u && u.length > 0 ? u : null
  } catch {
    researchProvenanceUrl = null
  }

  let lastResearchInvokePayload: Record<string, unknown> | null = null
  try {
    const pr = await pool.query<{ research_snapshot: unknown }>(
      `SELECT research_snapshot FROM research_results ORDER BY created_at DESC NULLS LAST LIMIT 1`
    )
    const raw = pr.rows[0]?.research_snapshot
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      lastResearchInvokePayload = raw as Record<string, unknown>
    }
  } catch {
    lastResearchInvokePayload = null
  }

  const jamSessionUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_JAM_SESSION_URL?.trim()
      ? process.env.NEXT_PUBLIC_JAM_SESSION_URL.trim()
      : null

  const gemini = Boolean(process.env.GEMINI_API_KEY?.trim())
  const firecrawl = Boolean(process.env.FIRE_CRAWL_KEY_2?.trim())
  const aiGatewayKey = hasAiGatewayApiKey()
  const aiGatewayConfigured = isAiGatewayConfigured()
  const gatewaySnap = getGatewayHealthSnapshot()
  const researchForceDirect = process.env.RESEARCH_FORCE_DIRECT_GEMINI?.trim().toLowerCase() !== 'false'
  const wantLiveProbe = authed && request.nextUrl.searchParams.get('probe') === '1'
  const gatewayProbe =
    wantLiveProbe && aiGatewayKey ? await probeAiGatewayConnection() : null
  const gatewayLiveOk = Boolean(gatewayProbe?.ok ?? gatewaySnap.ok)
  /** Research defaults to direct Gemini; gateway is optional failover for Zai / when forced off direct. */
  const gatewayOperational =
    gemini && (!aiGatewayConfigured || gatewayLiveOk || researchForceDirect)

  /** Zone Intelligence Strip polls this without a session — expose capability booleans only. */
  if (!authed) {
    return NextResponse.json({
      neon: neonOk,
      dbLatencyMs,
      gemini,
      firecrawl,
      aiGateway: aiGatewayConfigured,
      aiGatewayOk: gatewayOperational,
      aiGatewayFallback: gatewaySnap.usingFallback,
      aiGatewayDetail: !aiGatewayConfigured
        ? 'Set AI_GATEWAY_API_KEY, VERCEL_AI_GATEWAY_API_KEY, or AI_GATEWAY — or use direct GEMINI_API_KEY.'
        : researchForceDirect && !gatewayLiveOk
          ? 'Research uses direct Gemini; gateway reserved for Zai / failover.'
          : null,
      public: true,
    })
  }

  const rockTipProviderSample = [...new Set(ROCK_HABITS.map((h) => h.provider_name))].slice(0, 14)

  return NextResponse.json({
    neon: neonOk,
    dbLatencyMs,
    gemini,
    firecrawl,
    aiGateway: aiGatewayConfigured,
    aiGatewayOk: gatewayProbe ? gatewayProbe.ok : gatewayOperational,
    aiGatewayFallback: gatewaySnap.usingFallback || Boolean(gatewayProbe?.usingFallback),
    aiGatewayDetail:
      gatewayProbe?.detail ??
      (gatewayOperational
        ? researchForceDirect && !gatewayLiveOk
          ? 'Research uses direct Gemini; gateway reserved for Zai / failover.'
          : null
        : gatewaySnap.lastError),
    aiGatewayLastModel: gatewaySnap.lastModel,
    lastResearchScrapedAt,
    researchProvenanceUrl,
    lastResearchInvokePayload,
    jamSessionUrl,
    rockHabitCount: ROCK_HABIT_COUNT,
    rockCatalogPath: 'lib/rock/habitsCatalog.ts',
    rockTipProviderSample,
  })
}
