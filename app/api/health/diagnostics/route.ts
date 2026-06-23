import { NextRequest, NextResponse } from 'next/server'
import pool, { getDatabaseConnectionInfo, pingDatabase } from '@/lib/db'
import { ROCK_HABIT_COUNT, ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import { getSessionFromRequest } from '@/lib/auth'
import {
  bucketFailoverStatus,
  listConfiguredBucketProviders,
  getGatewayHealthSnapshot,
  hasAiGatewayApiKey,
  isAiGatewayConfigured,
  probeAiGatewayConnection,
} from '@/lib/intelligence/aiGateway'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import { isOpsAuthorized } from '@/lib/opsAuth'
import { resolveFirecrawlApiKey } from '@/lib/sentinel/api-config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  const ops = isOpsAuthorized(request)
  const hasSession = Boolean(session?.userId)
  const authed = hasSession || ops || gatewayTokenMatches(request)

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
  const firecrawl = Boolean(resolveFirecrawlApiKey())
  const aiGatewayKey = hasAiGatewayApiKey()
  const aiGatewayConfigured = isAiGatewayConfigured()
  const gatewaySnap = getGatewayHealthSnapshot()
  const researchForceDirect = process.env.RESEARCH_FORCE_DIRECT_GEMINI?.trim().toLowerCase() !== 'false'
  const wantLiveProbe = ops && request.nextUrl.searchParams.get('probe') === '1'
  const gatewayProbe =
    wantLiveProbe && aiGatewayKey ? await probeAiGatewayConnection() : null
  const gatewayLiveOk = Boolean(gatewayProbe?.ok ?? gatewaySnap.ok)
  /** Research defaults to direct Gemini; gateway is optional failover for Zai / when forced off direct. */
  const gatewayOperational =
    gemini && (!aiGatewayConfigured || gatewayLiveOk || researchForceDirect)
  const bucket = bucketFailoverStatus()
  const bucketProviders = listConfiguredBucketProviders()

  const debugMode = ops && request.nextUrl.searchParams.get('debug') === '1'
  const databaseConnectionInfo = debugMode ? getDatabaseConnectionInfo() : null

  /** Unsigned clients — DB reachability only. */
  if (!authed) {
    return NextResponse.json({
      neon: neonOk,
      status: neonOk ? 'ok' : 'degraded',
      public: true,
    })
  }

  /** Signed-in users — safe booleans only (no invoke snapshots / connection strings). */
  if (!ops && !gatewayTokenMatches(request)) {
    return NextResponse.json({
      neon: neonOk,
      dbLatencyMs,
      gemini,
      firecrawl,
      lastResearchScrapedAt,
      rockHabitCount: ROCK_HABIT_COUNT,
    })
  }

  const rockTipProviderSample = [...new Set(ROCK_HABITS.map((h) => h.provider_name))].slice(0, 14)

  return NextResponse.json({
    neon: neonOk,
    dbLatencyMs,
    gemini,
    firecrawl,
    bucket_failover: bucket,
    bucket_providers: bucketProviders,
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
    databaseConnectionInfo: databaseConnectionInfo ?? undefined,
  })
}
