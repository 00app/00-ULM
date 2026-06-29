import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionFromRequest, setSessionCookieOnResponse } from '@/lib/auth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { getLocalData } from '@/lib/local/getLocalData'
import { mirrorUlmGenomeToUserProfiles } from '@/lib/db/userProfilesMirror'
import { mapProfileGoalToPrimaryGoal } from '@/lib/zone/affluenceCheck'
import { withRestoreProof } from '@/lib/sessionRestoreProof'
import {
  hydratePropertyIntelligence,
  persistPropertyIntelligence,
} from '@/lib/intelligence/freeTierHydration'
import { persistPropertyPrefillForUser } from '@/lib/intelligence/persistPropertyPrefill'
import { buildResearchProfilePayload } from '@/lib/profile/buildResearchProfilePayload'
import { inferHouseholdIncomeBracket } from '@/lib/profile/inferHouseholdIncomeBracket'

export const dynamic = 'force-dynamic'

/** GET — session user or graceful null (never 500 for signed-out Zone). */
export async function GET() {
  try {
    const session = await getSessionFromRequest().catch(() => null)
    if (!session?.userId) {
      return NextResponse.json({ user: null })
    }
    const result = await pool.query(
      `SELECT id, name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome, created_at
       FROM users WHERE id = $1`,
      [session.userId]
    )
    if (!result.rows?.length) {
      return NextResponse.json({ user: null })
    }
    return NextResponse.json({ user: result.rows[0] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/user] GET error:', message)
    return NextResponse.json({ user: null })
  }
}

const USER_CREATE_MAX_PER_MINUTE = 5
/** Profile-only (no password) sessions are shorter-lived to reduce abuse impact. */
const PROFILE_ONLY_SESSION_DAYS = 7

export async function POST(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`user:${id}`, USER_CREATE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }
  try {
    const body = await request.json()
    const empIn =
      typeof body?.employment_status === 'string' ? body.employment_status.trim().toUpperCase().slice(0, 32) : ''
    const employment_status =
      empIn === 'STUDENT' || empIn === 'EMPLOYED' || empIn === 'BETWEEN_JOBS'
        ? empIn
        : empIn === 'SELF_EMPLOYED'
          ? 'EMPLOYED'
          : empIn === 'UNEMPLOYED' || empIn === 'NOT_WORK'
            ? 'BETWEEN_JOBS'
            : null

    const houseNumber =
      typeof body?.house_number === 'string' ? body.house_number.trim().slice(0, 32) : ''
    const homePowerRaw =
      typeof body?.home_power === 'string' ? body.home_power.trim().toUpperCase().slice(0, 16) : ''
    const home_power =
      homePowerRaw === 'GAS' ||
      homePowerRaw === 'ELECTRIC' ||
      homePowerRaw === 'MIX' ||
      homePowerRaw === 'OTHER'
        ? homePowerRaw
        : null

    const raw = {
      name: typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : '',
      postcode: typeof body?.postcode === 'string' ? body.postcode.replace(/\s+/g, '').trim().slice(0, 20) : '',
      household: typeof body?.household === 'string' ? body.household.trim().slice(0, 100) : '',
      home_type: typeof body?.home_type === 'string' ? body.home_type.trim().slice(0, 50) : '',
      transport: typeof body?.transport === 'string' ? body.transport.trim().slice(0, 50) : '',
      age_group: typeof body?.age_group === 'string' ? body.age_group.trim().slice(0, 20) : null as string | null,
      employment_status,
    }

    if (!raw.name || !raw.postcode || !raw.household || !raw.home_type || !raw.transport) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const goalRaw =
      typeof body?.goal === 'string' ? body.goal.trim().toLowerCase().slice(0, 32) : ''
    const profile_goal =
      goalRaw === 'money' || goalRaw === 'carbon' || goalRaw === 'balanced' ? goalRaw : null
    const incomeRaw =
      typeof body?.household_income_bracket === 'string'
        ? body.household_income_bracket.trim().slice(0, 50)
        : ''
    const household_income_bracket =
      incomeRaw === '<31k' || incomeRaw === '31k-50k' || incomeRaw === '50k+'
        ? incomeRaw
        : inferHouseholdIncomeBracket({
            employment_status: raw.employment_status,
            age_group: raw.age_group,
            postcode: raw.postcode,
          })
    const primary_goal = profile_goal ? mapProfileGoalToPrimaryGoal(profile_goal) : null
    const genomeObj: Record<string, unknown> = {}
    if (raw.employment_status != null) genomeObj.employment_status = raw.employment_status
    if (profile_goal) genomeObj.profile_goal = profile_goal
    if (primary_goal) genomeObj.primary_goal = primary_goal
    if (household_income_bracket) genomeObj.household_income_bracket = household_income_bracket
    if (houseNumber) genomeObj.house_number = houseNumber
    if (home_power) genomeObj.home_power = home_power
    const genome = JSON.stringify(genomeObj)

    const insertParams = [
      raw.name,
      raw.postcode,
      raw.household,
      raw.home_type,
      raw.transport,
      raw.age_group,
      raw.employment_status,
      genome,
    ]

    const runInsert = () =>
      pool.query(
        `INSERT INTO users (id, name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome, created_at`,
        insertParams
      )

    const [result, local, propertyIntelligence] = await Promise.all([
      runInsert().catch(async (insertErr: unknown) => {
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
        if (!/user_genome|employment_status|age_group|gen_random_uuid/i.test(msg)) throw insertErr
        console.warn('[api/user] INSERT fallback (legacy schema):', msg)
        return pool.query(
          `INSERT INTO users (id, name, postcode, household, home_type, transport_baseline)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING id, name, postcode, household, home_type, transport_baseline, created_at`,
          [raw.name, raw.postcode, raw.household, raw.home_type, raw.transport]
        )
      }),
      getLocalData(raw.postcode).catch(() => null),
      hydratePropertyIntelligence(raw.postcode, { houseNumber: houseNumber || null }).catch(() => null),
    ])
    const user = result.rows[0]

    let propertyPrefill: Awaited<ReturnType<typeof persistPropertyPrefillForUser>> | null = null
    if (propertyIntelligence && user?.id) {
      await persistPropertyIntelligence(String(user.id), propertyIntelligence)
      const profileData = buildResearchProfilePayload(
        {
          name: raw.name,
          postcode: raw.postcode,
          livingSituation: raw.household,
          homeType: raw.home_type,
          transport: raw.transport,
          age: raw.age_group ?? undefined,
          employmentStatus: raw.employment_status ?? undefined,
          powerType: home_power ?? undefined,
          houseNumber: houseNumber || undefined,
          goal: profile_goal ?? undefined,
        },
        { postcode: raw.postcode }
      )
      propertyPrefill = await persistPropertyPrefillForUser({
        userId: String(user.id),
        postcode: raw.postcode,
        propertyIntelligence,
        profileData,
      }).catch(() => null)
    }
    void mirrorUlmGenomeToUserProfiles(String(user.id), {
      employment_status: raw.employment_status,
      household_income_bracket,
      primary_goal,
      goal: profile_goal ?? undefined,
    })
    const token = await createSession(user.id, PROFILE_ONLY_SESSION_DAYS)
    const res = NextResponse.json(
      withRestoreProof(
        {
          id: user.id,
          user,
          location: local ?? undefined,
          property_intelligence: propertyIntelligence ?? undefined,
          property_prefill: propertyPrefill ?? undefined,
        },
        String(user.id)
      )
    )
    setSessionCookieOnResponse(res, token, PROFILE_ONLY_SESSION_DAYS * 24 * 60 * 60)
    return res
  } catch (error: unknown) {
    console.error('[api/user] POST error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
