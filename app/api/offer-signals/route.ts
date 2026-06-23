export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { resolveRequestIdentity } from '@/lib/requestAuth'
import { guestIpHashFromRequest } from '@/lib/zone/guestSession'
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
    const session = await getSessionFromRequest().catch(() => null)
    if (session?.userId) {
      const [disliked, indifferent] = await Promise.all([
        pool.query<{ card_id: string; card_title: string | null; journey_key: string | null }>(
          `SELECT DISTINCT ON (card_id) card_id, card_title, journey_key
           FROM offer_signals
           WHERE user_id = $1 AND signal = 'dislike'
           ORDER BY card_id, created_at DESC`,
          [session.userId]
        ),
        pool.query<{ card_id: string; card_title: string | null; journey_key: string | null }>(
          `SELECT DISTINCT ON (card_id) card_id, card_title, journey_key
           FROM offer_signals
           WHERE user_id = $1 AND signal = 'indifferent'
           ORDER BY card_id, created_at DESC`,
          [session.userId]
        ),
      ])
      return NextResponse.json({
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
    const card_id = typeof body?.card_id === 'string' ? body.card_id.trim().slice(0, 120) : ''
    const signal = parseSignal(body?.signal)
    const journey_key =
      typeof body?.journey_key === 'string' ? body.journey_key.trim().slice(0, 64) : null
    const card_title =
      typeof body?.card_title === 'string' ? body.card_title.trim().slice(0, 200) : null
    const money_gbp =
      typeof body?.money_gbp === 'number' && Number.isFinite(body.money_gbp)
        ? Math.round(body.money_gbp)
        : null

    const feedback_answer =
      typeof body?.feedback_answer === 'string' ? body.feedback_answer.trim().slice(0, 200) : null

    if (!card_id || !signal) {
      return NextResponse.json({ error: 'Invalid card_id or signal' }, { status: 400 })
    }

    const session = await getSessionFromRequest().catch(() => null)
    if (feedback_answer && (signal === 'like' || signal === 'dislike')) {
      if (session?.userId) {
        await pool.query(
          `UPDATE offer_signals
           SET feedback_answer = $4
           WHERE id = (
             SELECT id FROM offer_signals
             WHERE user_id = $1 AND card_id = $2 AND signal = $3
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [session.userId, card_id, signal, feedback_answer]
        )
        return NextResponse.json({ ok: true, signal, feedback: true })
      }
      const identity = await resolveRequestIdentity(request)
      if (identity?.kind === 'guest') {
        await pool.query(
          `UPDATE offer_signals
           SET feedback_answer = $4
           WHERE id = (
             SELECT id FROM offer_signals
             WHERE guest_session_id = $1 AND card_id = $2 AND signal = $3
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [identity.sessionId, card_id, signal, feedback_answer]
        )
        return NextResponse.json({ ok: true, signal, feedback: true })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session?.userId) {
      await pool.query(
        `INSERT INTO offer_signals (
          user_id, card_id, signal, journey_key, card_title, money_gbp, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [session.userId, card_id, signal, journey_key, card_title, money_gbp]
      )

      if (signal === 'dislike') {
        await pool.query('DELETE FROM likes WHERE user_id = $1 AND card_id = $2', [
          session.userId,
          card_id,
        ])
      } else if (signal === 'like') {
        await pool.query(
          `INSERT INTO likes (user_id, card_id, created_at) VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, card_id) DO NOTHING`,
          [session.userId, card_id]
        )
      }

      void updateHermesMemoryAfterOfferSignal({
        userId: session.userId,
        cardId: card_id,
        journeyKey: journey_key,
        signal,
        cardTitle: card_title,
      }).catch(() => {})

      return NextResponse.json({ ok: true, signal })
    }

    const identity = await resolveRequestIdentity(request)
    if (!identity || identity.kind !== 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await pool.query(
      `INSERT INTO offer_signals (
        guest_session_id, card_id, signal, journey_key, card_title, money_gbp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [identity.sessionId, card_id, signal, journey_key, card_title, money_gbp]
    )

    if (signal === 'dislike') {
      await appendGuestDislike(identity.sessionId, card_id, guestIpHashFromRequest(request))
    } else if (signal === 'like') {
      await removeGuestDislike(identity.sessionId, card_id)
    }

    return NextResponse.json({ ok: true, signal })
  } catch (error) {
    console.error('[offer-signals] POST', error)
    return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 })
  }
}
