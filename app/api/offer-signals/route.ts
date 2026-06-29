export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { resolveRequestIdentity } from '@/lib/requestAuth'
import {
  finalizeAuthenticatedResponse,
  resolveAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'
import { guestIpHashFromRequest, resolveGuestSessionId, setGuestSessionCookie } from '@/lib/zone/guestSession'
import { ensureGuestSessionRow } from '@/lib/zone/ensureGuestSessionRow'
import { OFFER_SIGNALS, type OfferSignal } from '@/lib/zone/offerSignals'
import { updateHermesMemoryAfterOfferSignal } from '@/lib/agents/hermes-memory'

export const runtime = 'nodejs'

function parseSignal(raw: unknown): OfferSignal | null {
  return typeof raw === 'string' && (OFFER_SIGNALS as readonly string[]).includes(raw)
    ? (raw as OfferSignal)
    : null
}

async function appendGuestDislike(sessionId: string, cardId: string, ipHash: string | null): Promise<void> {
  await ensureGuestSessionRow(sessionId, ipHash)
  const res = await pool.query<{ profile: unknown }>(
    `SELECT profile FROM guest_sessions WHERE session_id = $1`,
    [sessionId]
  )
  const profile =
    res.rows[0]?.profile && typeof res.rows[0].profile === 'object' && !Array.isArray(res.rows[0].profile)
      ? (res.rows[0].profile as Record<string, unknown>)
      : {}
  const current = Array.isArray(profile.disliked_card_ids)
    ? profile.disliked_card_ids.filter((id): id is string => typeof id === 'string')
    : []
  const next =
    current.includes(cardId) ? current : [...current, cardId]
  await pool.query(
    `UPDATE guest_sessions
     SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('disliked_card_ids', $2::jsonb),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, JSON.stringify(next)]
  )
}

async function removeGuestDislike(sessionId: string, cardId: string): Promise<void> {
  const res = await pool.query<{ profile: unknown }>(
    `SELECT profile FROM guest_sessions WHERE session_id = $1`,
    [sessionId]
  )
  const profile =
    res.rows[0]?.profile && typeof res.rows[0].profile === 'object' && !Array.isArray(res.rows[0].profile)
      ? (res.rows[0].profile as Record<string, unknown>)
      : {}
  const current = Array.isArray(profile.disliked_card_ids)
    ? profile.disliked_card_ids.filter((id): id is string => typeof id === 'string')
    : []
  if (!current.includes(cardId)) return
  const next = current.filter((id) => id !== cardId)
  await pool.query(
    `UPDATE guest_sessions
     SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('disliked_card_ids', $2::jsonb),
         updated_at = NOW()
     WHERE session_id = $1`,
    [sessionId, JSON.stringify(next)]
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedUser(request, {})
    if (auth?.userId) {
      const [disliked, indifferent] = await Promise.all([
        pool.query<{ card_id: string; card_title: string | null; journey_key: string | null }>(
          `SELECT DISTINCT ON (card_id) card_id, card_title, journey_key
           FROM offer_signals
           WHERE user_id = $1 AND signal = 'dislike'
           ORDER BY card_id, created_at DESC`,
          [auth.userId]
        ),
        pool.query<{ card_id: string; card_title: string | null; journey_key: string | null }>(
          `SELECT DISTINCT ON (card_id) card_id, card_title, journey_key
           FROM offer_signals
           WHERE user_id = $1 AND signal = 'indifferent'
           ORDER BY card_id, created_at DESC`,
          [auth.userId]
        ),
      ])
      const res = NextResponse.json({
        disliked_card_ids: disliked.rows.map((row) => row.card_id),
        indifferent_card_ids: indifferent.rows.map((row) => row.card_id),
        dislike_snapshots: disliked.rows.map((row) => ({
          id: row.card_id,
          title: row.card_title,
          journey_key: row.journey_key,
        })),
        indifferent_snapshots: indifferent.rows.map((row) => ({
          id: row.card_id,
          title: row.card_title,
          journey_key: row.journey_key,
        })),
      })
      return finalizeAuthenticatedResponse(res, auth)
    }

    const identity = await resolveRequestIdentity(request)
    if (!identity || identity.kind !== 'guest') {
      return NextResponse.json({
        disliked_card_ids: [],
        indifferent_card_ids: [],
        dislike_snapshots: [],
        indifferent_snapshots: [],
      })
    }

    const res = await pool.query<{ profile: unknown }>(
      `SELECT profile FROM guest_sessions WHERE session_id = $1`,
      [identity.sessionId]
    )
    const profile = res.rows[0]?.profile as { disliked_card_ids?: unknown } | undefined
    const ids = Array.isArray(profile?.disliked_card_ids)
      ? profile.disliked_card_ids.filter((id): id is string => typeof id === 'string')
      : []
    return NextResponse.json({
      disliked_card_ids: ids,
      indifferent_card_ids: [],
      dislike_snapshots: [],
      indifferent_snapshots: [],
    })
  } catch (error) {
    console.error('[offer-signals] GET', error)
    return NextResponse.json({
      disliked_card_ids: [],
      indifferent_card_ids: [],
      dislike_snapshots: [],
      indifferent_snapshots: [],
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const card_id = typeof bodyObj.card_id === 'string' ? bodyObj.card_id.trim().slice(0, 120) : ''
    const signal = parseSignal(bodyObj.signal)
    const journey_key =
      typeof bodyObj.journey_key === 'string' ? bodyObj.journey_key.trim().slice(0, 64) : null
    const card_title =
      typeof bodyObj.card_title === 'string' ? bodyObj.card_title.trim().slice(0, 200) : null
    const money_gbp =
      typeof bodyObj.money_gbp === 'number' && Number.isFinite(bodyObj.money_gbp)
        ? Math.round(bodyObj.money_gbp)
        : null

    const feedback_answer =
      typeof bodyObj.feedback_answer === 'string' ? bodyObj.feedback_answer.trim().slice(0, 200) : null

    if (!card_id || !signal) {
      return NextResponse.json({ error: 'Invalid card_id or signal' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedUser(request, bodyObj)
    if (feedback_answer && (signal === 'like' || signal === 'dislike')) {
      if (auth?.userId) {
        await pool.query(
          `UPDATE offer_signals
           SET feedback_answer = $4
           WHERE id = (
             SELECT id FROM offer_signals
             WHERE user_id = $1 AND card_id = $2 AND signal = $3
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [auth.userId, card_id, signal, feedback_answer]
        )
        const res = NextResponse.json({ ok: true, signal, feedback: true })
        return finalizeAuthenticatedResponse(res, auth)
      }
      const identity = await resolveRequestIdentity(request)
      const guestSessionId =
        identity?.kind === 'guest' ? identity.sessionId : resolveGuestSessionId(request)
      const ipHash = guestIpHashFromRequest(request)
      await ensureGuestSessionRow(guestSessionId, ipHash)
      await pool.query(
        `UPDATE offer_signals
         SET feedback_answer = $4
         WHERE id = (
           SELECT id FROM offer_signals
           WHERE guest_session_id = $1 AND card_id = $2 AND signal = $3
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [guestSessionId, card_id, signal, feedback_answer]
      )
      const res = NextResponse.json({ ok: true, signal, feedback: true })
      setGuestSessionCookie(res, guestSessionId)
      return res
    }

    if (auth?.userId) {
      await pool.query(
        `INSERT INTO offer_signals (
          user_id, card_id, signal, journey_key, card_title, money_gbp, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [auth.userId, card_id, signal, journey_key, card_title, money_gbp]
      )

      if (signal === 'dislike') {
        await pool.query('DELETE FROM likes WHERE user_id = $1 AND card_id = $2', [
          auth.userId,
          card_id,
        ])
      } else if (signal === 'like') {
        await pool.query(
          `INSERT INTO likes (user_id, card_id, created_at) VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, card_id) DO NOTHING`,
          [auth.userId, card_id]
        )
      }

      void updateHermesMemoryAfterOfferSignal({
        userId: auth.userId,
        cardId: card_id,
        journeyKey: journey_key,
        signal,
        cardTitle: card_title,
      }).catch(() => {})

      const res = NextResponse.json({ ok: true, signal })
      return finalizeAuthenticatedResponse(res, auth)
    }

    const identity = await resolveRequestIdentity(request)
    const guestSessionId =
      identity?.kind === 'guest' ? identity.sessionId : resolveGuestSessionId(request)
    const ipHash = guestIpHashFromRequest(request)
    await ensureGuestSessionRow(guestSessionId, ipHash)

    await pool.query(
      `INSERT INTO offer_signals (
        guest_session_id, card_id, signal, journey_key, card_title, money_gbp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [guestSessionId, card_id, signal, journey_key, card_title, money_gbp]
    )

    if (signal === 'dislike') {
      await appendGuestDislike(guestSessionId, card_id, ipHash)
    } else if (signal === 'like') {
      await removeGuestDislike(guestSessionId, card_id)
    }

    const res = NextResponse.json({ ok: true, signal })
    setGuestSessionCookie(res, guestSessionId)
    return res
  } catch (error) {
    console.error('[offer-signals] POST', error)
    return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 })
  }
}
