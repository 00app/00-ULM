/**
 * Session / IP-based state for returning users (no login).
 * When pushed live, client clears local data and rehydrates from here.
 * GET: return profile + journey_answers + completed_journeys for current session or IP.
 * POST: upsert state (profile, journey_answers, completed_journeys).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

export const dynamic = 'force-dynamic'

const COOKIE_NAME = 'zz_sid'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function hashIp(ip: string): string {
  let h = 0
  const s = ip.trim()
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return `ip_${Math.abs(h).toString(36)}`
}

function getSessionId(request: NextRequest): string {
  const cookie = request.cookies.get(COOKIE_NAME)?.value?.trim()
  if (cookie && cookie.length >= 16 && cookie.length <= 128) return cookie
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function getIpHash(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')?.trim()
  if (!ip) return null
  return hashIp(ip)
}

/** GET — return profile, journey_answers, completed_journeys for this session (or IP fallback). */
export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request)
    const ipHash = getIpHash(request)
    const pool = getDbPool()

    let row: { profile: unknown; journey_answers: unknown; completed_journeys: unknown } | null = null

    const bySession = await pool.query(
      `SELECT profile, journey_answers, completed_journeys FROM guest_sessions WHERE session_id = $1`,
      [sessionId]
    )
    let setCookieValue = sessionId
    if (bySession.rows.length > 0) {
      row = bySession.rows[0] as typeof row
    } else if (ipHash) {
      const byIp = await pool.query(
        `SELECT session_id, profile, journey_answers, completed_journeys FROM guest_sessions WHERE ip_hash = $1 ORDER BY updated_at DESC LIMIT 1`,
        [ipHash]
      )
      if (byIp.rows.length > 0) {
        const found = byIp.rows[0] as { session_id: string; profile: unknown; journey_answers: unknown; completed_journeys: unknown }
        row = { profile: found.profile, journey_answers: found.journey_answers, completed_journeys: found.completed_journeys }
        setCookieValue = found.session_id
      }
    }

    const profile = (row?.profile as Record<string, string> | null) ?? {}
    const journeyAnswers = (row?.journey_answers as Record<string, Record<string, string>> | null) ?? {}
    const completedJourneys = Array.isArray(row?.completed_journeys) ? (row.completed_journeys as string[]) : []

    const res = NextResponse.json({
      profile: {
        name: profile.name ?? '',
        postcode: profile.postcode ?? '',
        household: profile.household ?? '',
        home_type: profile.home_type ?? '',
        transport: profile.transport ?? '',
        age: profile.age ?? '',
        employment_status: profile.employment_status ?? '',
      },
      journeyAnswers: JOURNEY_ORDER.reduce<Record<string, Record<string, string>>>((acc, jid) => {
        const a = journeyAnswers[jid]
        if (a && typeof a === 'object') acc[jid] = a
        return acc
      }, {}),
      completedJourneys,
    })
    res.cookies.set(COOKIE_NAME, setCookieValue, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: false })
    return res
  } catch (e) {
    console.error('[session-state] GET error:', e)
    return NextResponse.json({ error: 'Failed to load session state' }, { status: 500 })
  }
}

/** POST — upsert profile, journey_answers, completed_journeys for this session. */
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request)
    const ipHash = getIpHash(request)
    const body = await request.json().catch(() => ({}))
    const profile = (body.profile as Record<string, string>) ?? {}
    const journeyAnswers = (body.journeyAnswers as Record<string, Record<string, string>>) ?? {}
    const completedJourneys = Array.isArray(body.completedJourneys) ? body.completedJourneys : []

    const pool = getDbPool()
    await pool.query(
      `INSERT INTO guest_sessions (session_id, ip_hash, profile, journey_answers, completed_journeys, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET
         ip_hash = COALESCE(EXCLUDED.ip_hash, guest_sessions.ip_hash),
         profile = $3,
         journey_answers = $4,
         completed_journeys = $5,
         updated_at = NOW()`,
      [sessionId, ipHash, JSON.stringify(profile), JSON.stringify(journeyAnswers), JSON.stringify(completedJourneys)]
    )

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, sessionId, { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: false })
    return res
  } catch (e) {
    console.error('[session-state] POST error:', e)
    return NextResponse.json({ error: 'Failed to save session state' }, { status: 500 })
  }
}
