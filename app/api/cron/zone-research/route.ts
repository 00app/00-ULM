import { NextRequest, NextResponse } from 'next/server'
import { getDbPool, shutdownDbPool } from '@/lib/db'
import { runZeroResearchWithProfile } from '@/lib/agents/researchAgent'
import { profileGoalFromGenome } from '@/lib/agents/auditor'
import { normalizeSecret } from '@/lib/intelligence/normalizeSecret'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorizeCron(request: NextRequest): boolean {
  const secret = normalizeSecret(process.env.CRON_SECRET)
  if (!secret || secret.length < 16) return false
  const bearer = normalizeSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const header = normalizeSecret(request.headers.get('x-cron-secret'))
  return bearer === secret || header === secret
}

type UserResearchSeedRow = {
  id: string
  postcode: string | null
  home_type: string | null
  household: string | null
  transport_baseline: string | null
  age_group: string | null
  employment_status: string | null
  user_genome: unknown
}

/**
 * Hermes / Vercel Cron: Firecrawl-backed `runZeroResearchWithProfile` per `users` row (postcode + profile seeds → Neon).
 * `users` holds the same onboarding answers as the client profile (`user_genome.profile_goal`, transport, etc.).
 *
 * `GET` or `POST` /api/cron/zone-research?limit=20 — `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
 */
async function runZoneResearchCron(request: NextRequest): Promise<Response> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('limit') ?? '20'
  const limit = Math.min(50, Math.max(1, parseInt(raw, 10) || 20))

  try {
    const res = await getDbPool().query<UserResearchSeedRow>(
      `SELECT id, postcode, home_type, household, transport_baseline,
              age_group, employment_status, user_genome
       FROM users
       WHERE postcode IS NOT NULL
         AND TRIM(postcode) <> ''
         AND LENGTH(TRIM(REPLACE(postcode, ' ', ''))) >= 4
       ORDER BY created_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    )

    console.log('[cron/zone-research] connected; batch', res.rows?.length ?? 0)

    const results: Array<{ userId: string; postcode: string; ok: boolean }> = []
    for (const row of res.rows ?? []) {
      const pc = row.postcode?.replace(/\s+/g, '').toUpperCase() ?? ''
      if (pc.length < 4) continue
      const genome =
        row.user_genome && typeof row.user_genome === 'object' && !Array.isArray(row.user_genome)
          ? (row.user_genome as Record<string, unknown>)
          : null
      const goal = profileGoalFromGenome(genome)
      try {
        await runZeroResearchWithProfile({
          postcode: pc,
          profileData: {
            postcode: pc,
            home_type: row.home_type,
            household: row.household,
            transport_baseline: row.transport_baseline,
            employment_status: row.employment_status,
            goal,
            age_group: row.age_group ?? undefined,
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

export async function GET(request: NextRequest) {
  return runZoneResearchCron(request)
}

export async function POST(request: NextRequest) {
  return runZoneResearchCron(request)
}
