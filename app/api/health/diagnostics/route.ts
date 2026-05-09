import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { ROCK_HABIT_COUNT, ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Server-side nervous-system checks (no secret values exposed — booleans + timestamps only).
 */
function hasGatewayAuth(request: NextRequest): boolean {
  const expected =
    process.env.GATEWAY_TOKEN?.trim() ||
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!expected) return false
  const got =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim() ??
    request.headers.get('x-gateway-token')?.trim()
  return got === expected
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  if (!session && !hasGatewayAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let neonOk = false
  let dbLatencyMs: number | null = null
  let lastResearchScrapedAt: string | null = null

  try {
    const t0 = Date.now()
    await pool.query('SELECT 1')
    neonOk = true
    dbLatencyMs = Math.max(0, Date.now() - t0)
  } catch {
    neonOk = false
    dbLatencyMs = null
  }

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
    const pr = await pool.query<{ openclaw_raw_json: unknown }>(
      `SELECT openclaw_raw_json FROM research_results ORDER BY created_at DESC NULLS LAST LIMIT 1`
    )
    const raw = pr.rows[0]?.openclaw_raw_json
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
  const firecrawl = Boolean(process.env.FIRECRAWL_API_KEY?.trim())

  const rockTipProviderSample = [...new Set(ROCK_HABITS.map((h) => h.provider_name))].slice(0, 14)

  return NextResponse.json({
    neon: neonOk,
    dbLatencyMs,
    gemini,
    firecrawl,
    lastResearchScrapedAt,
    researchProvenanceUrl,
    lastResearchInvokePayload,
    jamSessionUrl,
    rockHabitCount: ROCK_HABIT_COUNT,
    rockCatalogPath: 'lib/rock/habitsCatalog.ts',
    rockTipProviderSample,
  })
}
