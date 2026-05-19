import { NextRequest, NextResponse } from 'next/server'
import { getDbPool, shutdownDbPool } from '@/lib/db'
import { runZeroResearchWithProfile } from '@/lib/agents/researchAgent'
import { profileGoalFromGenome } from '@/lib/agents/auditor'
import { normalizePrimaryGoal } from '@/lib/zone/affluenceCheck'
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
  profile_primary_goal: string | null
  profile_income_bracket: string | null
  profile_employment_status: string | null
}

/**
 * Hermes / Vercel Cron: Firecrawl-backed `runZeroResearchWithProfile` per `users` row (postcode + profile seeds → Neon).
 * Pulls `primary_goal` / income bracket from `user_profiles` when present, else `users.user_genome`.
 *
 * `GET` or `POST` /api/cron/zone-research?limit=20 — `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
 */
async function runZoneResearchCron(request: NextRequest): Promise<Response> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('limit') ?? '20'
  const limit = Math.min(50, Math.max(1, parseInt(raw, 10) || 20))
  const lifestyleShift =
    request.nextUrl.searchParams.get('lifestyle_shift') === '1' ||
    request.nextUrl.searchParams.get('lifestyle_mode') === 'lifestyle_shift'
  const lifestyleContext = lifestyleShift
    ? 'MODE: lifestyle_shift — pattern arbitrage (rail vs flight, EV swap, local holidays). Reject generic homepage URLs; require deep-linked UK portals only.'
    : undefined

  try {
    const res = await getDbPool().query<UserResearchSeedRow>(
      `SELECT u.id, u.postcode, u.home_type, u.household, u.transport_baseline,
              u.age_group, u.employment_status, u.user_genome,
              up.primary_goal AS profile_primary_goal,
              up.household_income_bracket AS profile_income_bracket,
              up.employment_status AS profile_employment_status
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.postcode IS NOT NULL
         AND TRIM(u.postcode) <> ''
         AND LENGTH(TRIM(REPLACE(u.postcode, ' ', ''))) >= 4
       ORDER BY u.created_at DESC NULLS LAST
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
      const goalFromGenome = profileGoalFromGenome(genome)
      const goal = normalizePrimaryGoal(
        row.profile_primary_goal?.trim() ||
          (typeof genome?.primary_goal === 'string' ? genome.primary_goal : goalFromGenome)
      )
      const householdIncomeBracket =
        row.profile_income_bracket?.trim() ||
        (typeof genome?.household_income_bracket === 'string'
          ? genome.household_income_bracket
          : undefined)
      const employmentStatus =
        row.profile_employment_status?.trim() || row.employment_status?.trim() || undefined
      try {
        await runZeroResearchWithProfile({
          postcode: pc,
          profileData: {
            postcode: pc,
            home_type: row.home_type,
            household: row.household,
            transport_baseline: row.transport_baseline,
            employment_status: employmentStatus,
            household_income_bracket: householdIncomeBracket,
            primary_goal: goal,
            goal,
            age_group: row.age_group ?? undefined,
          },
          userContext: lifestyleContext,
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
      lifestyle_mode: lifestyleShift ? 'lifestyle_shift' : null,
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
