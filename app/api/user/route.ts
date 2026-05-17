import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionCookieAttributes, getSessionFromRequest } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { getLocalData } from '@/lib/local/getLocalData'

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

const USER_CREATE_MAX_PER_MINUTE = 10
/** Profile-only (no password) sessions are shorter-lived to reduce abuse impact. */
const PROFILE_ONLY_SESSION_DAYS = 7

export async function POST(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = checkRateLimit(`user:${id}`, USER_CREATE_MAX_PER_MINUTE)
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
      empIn === 'EMPLOYED' || empIn === 'SELF_EMPLOYED' || empIn === 'UNEMPLOYED' ? empIn : null

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
    const genomeObj: Record<string, unknown> = {}
    if (raw.employment_status != null) genomeObj.employment_status = raw.employment_status
    if (profile_goal) genomeObj.profile_goal = profile_goal
    const genome = JSON.stringify(genomeObj)

    const [result, local] = await Promise.all([
      pool
        .query(
          `INSERT INTO users (name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, name, postcode, household, home_type, transport_baseline, age_group, employment_status, user_genome, created_at`,
          [raw.name, raw.postcode, raw.household, raw.home_type, raw.transport, raw.age_group, raw.employment_status, genome]
        )
        .catch(async (insertErr: unknown) => {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
          if (!/user_genome|employment_status|age_group/i.test(msg)) throw insertErr
          console.warn('[api/user] INSERT fallback (legacy schema):', msg)
          return pool.query(
            `INSERT INTO users (name, postcode, household, home_type, transport_baseline)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, postcode, household, home_type, transport_baseline, created_at`,
            [raw.name, raw.postcode, raw.household, raw.home_type, raw.transport]
          )
        }),
      getLocalData(raw.postcode).catch(() => null),
    ])
    const user = result.rows[0]
    const token = await createSession(user.id, PROFILE_ONLY_SESSION_DAYS)
    const { name: cookieName, options } = getSessionCookieAttributes(PROFILE_ONLY_SESSION_DAYS * 24 * 60 * 60)
    const res = NextResponse.json({ id: user.id, user, location: local ?? undefined })
    res.cookies.set(cookieName, token, options)
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create user', details: message },
      { status: 500 }
    )
  }
}
