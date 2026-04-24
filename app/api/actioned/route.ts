/**
 * Truth vs Potential: cards marked as "Actioned" move saving from Potential to Truth.
 * GET: return list of actioned card IDs for the current user.
 * POST: toggle actioned state for a card_id (body: { card_id: string }).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSessionFromRequest()
    if (!session?.userId) {
      return NextResponse.json({ actioned_card_ids: [] })
    }
    const result = await pool.query(
      'SELECT card_id FROM user_actioned_cards WHERE user_id = $1',
      [session.userId]
    )
    const actioned_card_ids = (result.rows || []).map((r: { card_id: string }) => r.card_id)
    return NextResponse.json({ actioned_card_ids })
  } catch (e) {
    console.error('[actioned] GET error:', e)
    return NextResponse.json({ actioned_card_ids: [] }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session?.userId) {
      return NextResponse.json({ actioned: false }, { status: 401 })
    }
    const body = await request.json()
    const cardId = typeof body?.card_id === 'string' ? body.card_id.trim() : null
    if (!cardId) {
      return NextResponse.json({ error: 'Missing card_id' }, { status: 400 })
    }
    const existing = await pool.query(
      'SELECT 1 FROM user_actioned_cards WHERE user_id = $1 AND card_id = $2',
      [session.userId, cardId]
    )
    const isActioned = (existing.rows?.length ?? 0) > 0
    if (isActioned) {
      await pool.query(
        'DELETE FROM user_actioned_cards WHERE user_id = $1 AND card_id = $2',
        [session.userId, cardId]
      )
      return NextResponse.json({ actioned: false })
    }
    await pool.query(
      'INSERT INTO user_actioned_cards (user_id, card_id) VALUES ($1, $2) ON CONFLICT (user_id, card_id) DO NOTHING',
      [session.userId, cardId]
    )
    return NextResponse.json({ actioned: true })
  } catch (e) {
    console.error('[actioned] POST error:', e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
