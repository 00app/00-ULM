import { NextRequest, NextResponse } from 'next/server'
import { getDbPool, shutdownDbPool } from '@/lib/db'
import { runZeroResearchWithProfile } from '@/lib/agents/researchAgent'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 16) return false
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const header = request.headers.get('x-cron-secret')?.trim()
  return bearer === secret || header === secret
}

/**
 * Hermes / Oracle VPS / Vercel Cron: refresh Firecrawl-backed research per user, tied to `research_results.user_id`.
 * Set `CRON_SECRET` in production; call with `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
 *
 * Query: `GET /api/cron/zone-research?limit=20`
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('limit') ?? '20'
  const limit = Math.min(50, Math.max(1, parseInt(raw, 10) || 20))

  try {
    const res = await getDbPool().query<{
      id: string
      postcode: string | null
      home_type: string | null
      household: string | null
      transport_baseline: string | null
    }>(
      `SELECT id, postcode, home_type, household, transport_baseline
       FROM users
       WHERE postcode IS NOT NULL
         AND TRIM(postcode) <> ''
         AND LENGTH(TRIM(REPLACE(postcode, ' ', ''))) >= 4
       ORDER BY created_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    )

    console.log('[cron/zone-research] Successfully connected to London DB')

    const results: Array<{ userId: string; postcode: string; ok: boolean }> = []
    for (const row of res.rows ?? []) {
      const pc = row.postcode?.replace(/\s+/g, '').toUpperCase() ?? ''
      if (pc.length < 4) continue
      try {
        await runZeroResearchWithProfile({
          postcode: pc,
          profileData: {
            postcode: pc,
            home_type: row.home_type,
            household: row.household,
            transport_baseline: row.transport_baseline,
          },
          persistToNeon: true,
          userId: row.id,
        })
        results.push({ userId: row.id, postcode: pc, ok: true })
      } catch {
        results.push({ userId: row.id, postcode: pc, ok: false })
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    await shutdownDbPool()
  }
}
