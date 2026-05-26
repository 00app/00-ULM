/**
 * Record card / journey visits for guests (zz_sid) and signed-in users — no Gemini.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import {
  guestIpHashFromRequest,
  normaliseVisitedCardIds,
  normaliseVisitedJourneyKeys,
  resolveGuestSessionId,
  setGuestSessionCookie,
} from '@/lib/zone/guestSession'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import type { JourneyId } from '@/lib/journeys'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'

export const runtime = 'nodejs'

function journeyFromCardId(cardId: string): JourneyId | null {
  const id = cardId.trim()
  if (id.startsWith('journey-')) {
    const j = id.slice('journey-'.length)
    return normalizeCategoryToJourneyKey(j)
  }
  const m = id.match(/^tip-([a-z]+)$/i)
  if (m?.[1]) return normalizeCategoryToJourneyKey(m[1])
  const rock = id.match(/^rock-([a-z0-9-]+)$/i)
  if (rock) return null
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const cardId =
      typeof body?.card_id === 'string' && body.card_id.trim()
        ? body.card_id.trim().slice(0, 256)
        : ''
    if (!cardId) {
      return NextResponse.json({ error: 'card_id required' }, { status: 400 })
    }

    const journeyRaw =
      typeof body?.journey_key === 'string' && body.journey_key.trim()
        ? body.journey_key.trim()
        : ''
    const journeyKey = journeyRaw
      ? normalizeCategoryToJourneyKey(journeyRaw.replace(/^journey-/, ''))
      : journeyFromCardId(cardId)

    const urlRaw = typeof body?.url === 'string' ? body.url.trim() : ''
    const offerUrl =
      urlRaw.startsWith('http') && journeyKey
        ? sanitizeZoneOfferUrl(urlRaw, journeyKey)
        : urlRaw.startsWith('http')
          ? urlRaw
          : ''

    const session = await getSessionFromRequest().catch(() => null)
    const guestSessionId = resolveGuestSessionId(request)
    const ipHash = guestIpHashFromRequest(request)

    if (session?.userId) {
      await pool.query(
        `INSERT INTO likes (user_id, card_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, card_id) DO NOTHING`,
        [session.userId, cardId]
      )
      if (journeyKey) {
        try {
          await pool.query(
            `UPDATE research_results
             SET last_visited_at = NOW()
             WHERE id = (
               SELECT id FROM research_results
               WHERE user_id = $1::uuid
                 AND lower(trim(category)) = $2
               ORDER BY created_at DESC NULLS LAST
               LIMIT 1
             )`,
            [session.userId, journeyKey]
          )
        } catch {
          /* migration */
        }
      }
    }

    const existing = await pool.query<{
      visited_card_ids: unknown
      visited_journey_keys: unknown
    }>(
      `SELECT visited_card_ids, visited_journey_keys FROM guest_sessions WHERE session_id = $1`,
      [guestSessionId]
    )
    const prevCards = normaliseVisitedCardIds(existing.rows[0]?.visited_card_ids)
    const prevJourneys = normaliseVisitedJourneyKeys(existing.rows[0]?.visited_journey_keys)
    const visited_card_ids = [...new Set([...prevCards, cardId])]
    const visited_journey_keys = journeyKey
      ? [...new Set([...prevJourneys, journeyKey])]
      : prevJourneys

    await pool.query(
      `INSERT INTO guest_sessions (
         session_id, ip_hash, visited_card_ids, visited_journey_keys, updated_at
       )
       VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET
         ip_hash = COALESCE(EXCLUDED.ip_hash, guest_sessions.ip_hash),
         visited_card_ids = $3::jsonb,
         visited_journey_keys = $4::jsonb,
         updated_at = NOW()`,
      [
        guestSessionId,
        ipHash,
        JSON.stringify(visited_card_ids),
        JSON.stringify(visited_journey_keys),
      ]
    )

    const res = NextResponse.json({
      ok: true,
      card_id: cardId,
      journey_key: journeyKey,
      visited_card_ids,
      visited_journey_keys,
      user_id: session?.userId ?? null,
    })
    setGuestSessionCookie(res, guestSessionId)
    return res
  } catch (error) {
    console.error('[zone/visit]', error)
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 })
  }
}
