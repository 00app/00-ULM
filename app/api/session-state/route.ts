/**
 * Session / IP-based state for returning users (no login).
 * When pushed live, client clears local data and rehydrates from here.
 * GET: return profile + journey_answers + completed_journeys for current session or IP.
 * POST: upsert state (profile, journey_answers, completed_journeys).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDbPool } from '@/lib/db'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import {
  guestIpHashFromRequest,
  normaliseVisitedCardIds,
  normaliseVisitedJourneyKeys,
  resolveGuestSessionId,
  setGuestSessionCookie,
} from '@/lib/zone/guestSession'

export const dynamic = 'force-dynamic'

/** GET — return profile, journey_answers, completed_journeys for this session (or IP fallback). */
export async function GET(request: NextRequest) {
  try {
    const sessionId = resolveGuestSessionId(request)
    const ipHash = guestIpHashFromRequest(request)
    const pool = getDbPool()

    let row: {
      profile: unknown
      journey_answers: unknown
      completed_journeys: unknown
      visited_card_ids: unknown
      visited_journey_keys: unknown
    } | null = null

    const bySession = await pool.query(
      `SELECT profile, journey_answers, completed_journeys, visited_card_ids, visited_journey_keys
       FROM guest_sessions WHERE session_id = $1`,
      [sessionId]
    )
    let setCookieValue = sessionId
    if (bySession.rows.length > 0) {
      row = bySession.rows[0] as typeof row
    } else if (ipHash) {
      const byIp = await pool.query(
        `SELECT session_id, profile, journey_answers, completed_journeys, visited_card_ids, visited_journey_keys
         FROM guest_sessions WHERE ip_hash = $1 ORDER BY updated_at DESC LIMIT 1`,
        [ipHash]
      )
      if (byIp.rows.length > 0) {
        const found = byIp.rows[0] as {
          session_id: string
          profile: unknown
          journey_answers: unknown
          completed_journeys: unknown
          visited_card_ids: unknown
          visited_journey_keys: unknown
        }
        row = {
          profile: found.profile,
          journey_answers: found.journey_answers,
          completed_journeys: found.completed_journeys,
          visited_card_ids: found.visited_card_ids,
          visited_journey_keys: found.visited_journey_keys,
        }
        setCookieValue = found.session_id
      }
    }

    const profile = (row?.profile as Record<string, string> | null) ?? {}
    const journeyAnswers = (row?.journey_answers as Record<string, Record<string, string>> | null) ?? {}
    const completedJourneys = Array.isArray(row?.completed_journeys) ? (row.completed_journeys as string[]) : []

    const visitedCardIds = normaliseVisitedCardIds(row?.visited_card_ids)
    const visitedJourneyKeys = normaliseVisitedJourneyKeys(row?.visited_journey_keys)

    const res = NextResponse.json({
      visitedCardIds,
      visitedJourneyKeys,
      profile: {
        name: profile.name ?? '',
        postcode: profile.postcode ?? '',
        household: profile.household ?? '',
        home_type: profile.home_type ?? '',
        home_power: profile.home_power ?? '',
        transport: profile.transport ?? '',
        age: profile.age ?? '',
        employment_status: profile.employment_status ?? '',
        goal: profile.goal ?? '',
      },
      journeyAnswers: JOURNEY_ORDER.reduce<Record<string, Record<string, string>>>((acc, jid) => {
        const a = journeyAnswers[jid]
        if (a && typeof a === 'object') acc[jid] = a
        return acc
      }, {}),
      completedJourneys,
    })
    setGuestSessionCookie(res, setCookieValue)
    return res
  } catch (e) {
    console.error('[session-state] GET error:', e)
    return NextResponse.json({ error: 'Failed to load session state' }, { status: 500 })
  }
}

/** POST — upsert profile, journey_answers, completed_journeys for this session. */
export async function POST(request: NextRequest) {
  try {
    const sessionId = resolveGuestSessionId(request)
    const ipHash = guestIpHashFromRequest(request)
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
    setGuestSessionCookie(res, sessionId)
    return res
  } catch (e) {
    console.error('[session-state] POST error:', e)
    return NextResponse.json({ error: 'Failed to save session state' }, { status: 500 })
  }
}
