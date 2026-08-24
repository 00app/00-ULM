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
import { normalizeEmploymentStatus } from '@/lib/profile/employmentSegment'

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
    const employment_status =
      normalizeEmploymentStatus(
        typeof body?.employment_status === 'string' ? body.employment_status : undefined
      ) ?? null

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
    const homeOwnershipRaw =
      typeof body?.home_ownership === 'string'
        ? body.home_ownership.trim().toUpperCase().slice(0, 16)
        : ''
    const home_ownership =
      homeOwnershipRaw === 'OWNER' || homeOwnershipRaw === 'RENTER' ? homeOwnershipRaw : null
    const washPreferenceRaw =
      typeof body?.wash_preference === 'string'
        ? body.wash_preference.trim().toUpperCase().slice(0, 16)
        : ''
    const wash_preference =
      washPreferenceRaw === 'SHOWER' || washPreferenceRaw === 'BATH' || washPreferenceRaw === 'BOTH'
        ? washPreferenceRaw
        : null
    const flightFrequencyRaw =
      typeof body?.flight_frequency === 'string'
        ? body.flight_frequency.trim().toUpperCase().slice(0, 16)
        : ''
    const flight_frequency =
      flightFrequencyRaw === 'NONE' ||
      flightFrequencyRaw === 'ONE_TWO' ||
      flightFrequencyRaw === 'THREE_PLUS'
        ? flightFrequencyRaw
        : null
    const financialPressureRaw =
      typeof body?.financial_pressure === 'string'
        ? body.financial_pressure.trim().toUpperCase().slice(0, 16)
        : ''
    const financial_pressure =
      financialPressureRaw === 'TIGHT' ||
      financialPressureRaw === 'GETTING_BY' ||
      financialPressureRaw === 'DOING_OK'
        ? financialPressureRaw
        : null
    const childrenRaw =
      typeof body?.children === 'string' ? body.children.trim().toUpperCase().slice(0, 16) : ''
    const children =
      childrenRaw === 'NO' ||
      childrenRaw === 'UNDER_5' ||
      childrenRaw === 'SCHOOL_AGE' ||
      childrenRaw === 'BOTH'
        ? childrenRaw
        : null

    const helpGoalRaw =
      typeof body?.help_goal === 'string' ? body.help_goal.trim().toUpperCase().slice(0, 16) : ''
    const help_goal =
      helpGoalRaw === 'CUT_BILLS' ||
      helpGoalRaw === 'CLEAR_DEBT' ||
      helpGoalRaw === 'FIND_WORK' ||
      helpGoalRaw === 'KEEP_HOME'
        ? helpGoalRaw
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
    /**
     * TIGHT is allowed to force the low-income bracket, but DOING_OK is deliberately NOT allowed
     * to force a high one. The asymmetry is the point: this is self-reported *pressure*, not
     * income. Someone earning £60k with a large mortgage can honestly answer TIGHT, and the
     * existing inference (which keys off employment status) misses exactly that in-work poverty
     * case — so letting TIGHT through only ever ADDS grant/entitlement content, which is safe.
     * "Doing OK" means unstressed, which is not the same as well paid; treating it as £50k+
     * would strip means-tested content from someone on a modest income who actually qualifies.
     * So the two easier answers fall through to the normal inference untouched.
     */
    const pressureImpliedBracket = financial_pressure === 'TIGHT' ? '<31k' : null
    const household_income_bracket =
      incomeRaw === '<31k' || incomeRaw === '31k-50k' || incomeRaw === '50k+'
        ? incomeRaw
        : (pressureImpliedBracket ??
          inferHouseholdIncomeBracket({
            employment_status: raw.employment_status,
            age_group: raw.age_group,
            postcode: raw.postcode,
          }))
    const primary_goal = profile_goal ? mapProfileGoalToPrimaryGoal(profile_goal) : null
    const genomeObj: Record<string, unknown> = {}
    if (raw.employment_status != null) genomeObj.employment_status = raw.employment_status
    if (profile_goal) genomeObj.profile_goal = profile_goal
    if (primary_goal) genomeObj.primary_goal = primary_goal
    if (household_income_bracket) genomeObj.household_income_bracket = household_income_bracket
    if (houseNumber) genomeObj.house_number = houseNumber
    if (home_power) genomeObj.home_power = home_power
    if (home_ownership) genomeObj.home_ownership = home_ownership
    if (wash_preference) genomeObj.wash_preference = wash_preference
    if (flight_frequency) genomeObj.flight_frequency = flight_frequency
    if (financial_pressure) genomeObj.financial_pressure = financial_pressure
    if (children) genomeObj.children = children
    if (help_goal) genomeObj.help_goal = help_goal
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

    /**
     * `requirePasswordless` must be true whenever `existingId` came from the unauthenticated
     * name+postcode lookup below, and MUST be false for the session-cookie path — a verified
     * session is already proof of ownership of that exact account, password or not, and a
     * legitimately logged-in password-protected user has to be able to re-submit onboarding
     * through their own session. Restricting to password-less rows only matters for the lookup
     * that has no proof of identity at all.
     */
    const runUpdate = (existingId: string, requirePasswordless: boolean) =>
      pool.query(
        `UPDATE users
         SET name = $1, postcode = $2, household = $3, home_type = $4, transport_baseline = $5,
             age_group = $6, employment_status = $7, user_genome = user_genome || $8::jsonb
         WHERE id = $9 ${requirePasswordless ? 'AND password_hash IS NULL' : ''}
         RETURNING id, name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome, created_at`,
        [...insertParams, existingId]
      )

    // Reattach repeat onboarding to an existing account instead of forking a new user row each
    // time. Two ways to find "the same person" without a real login system: (1) their browser
    // already carries a valid session cookie — reuse that user, or (2) no session, but a
    // password-less profile-only user with the same normalized name+postcode already exists —
    // reuse that one. Only fall through to a fresh INSERT when neither matches.
    //
    // The `password_hash IS NULL` guard on the lookup below is load bearing: without it, anyone
    // who knows a target's name and postcode (public information) could POST here with no
    // password at all, get matched to that person's real registered account, receive a valid
    // session cookie for it, and overwrite their profile — a full account takeover with zero
    // authentication. Restricting the match to password-less rows means this unauthenticated
    // path can only ever reattach to an account nobody has secured with a password yet.
    const currentSession = await getSessionFromRequest().catch(() => null)
    let existingUserId: string | null = currentSession?.userId ?? null
    let existingUserNeedsPasswordlessGuard = false
    if (!existingUserId) {
      const match = await pool.query(
        `SELECT id FROM users WHERE LOWER(name) = LOWER($1) AND postcode = $2 AND password_hash IS NULL ORDER BY created_at DESC LIMIT 1`,
        [raw.name, raw.postcode]
      )
      existingUserId = match.rows[0]?.id ? String(match.rows[0].id) : null
      existingUserNeedsPasswordlessGuard = true
    }

    const [result, local, propertyIntelligence] = await Promise.all([
      (existingUserId
        ? runUpdate(existingUserId, existingUserNeedsPasswordlessGuard)
        : runInsert()
      ).catch(async (insertErr: unknown) => {
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
