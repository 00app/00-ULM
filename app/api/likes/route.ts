export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

/** v1.8.14 — Production lock: likes route must not initiate third-party messaging. */
const DISALLOW_OUTBOUND = true
void DISALLOW_OUTBOUND

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const body = await request.json()
    const card_id = typeof body?.card_id === 'string' ? body.card_id.trim() : ''

    if (!card_id || card_id.length > 100) {
      return NextResponse.json(
        { error: 'Missing or invalid card_id' },
        { status: 400 }
      )
    }

    // Check if like exists
    const existing = await pool.query(
      'SELECT * FROM likes WHERE user_id = $1 AND card_id = $2',
      [user_id, card_id]
    )

    if (existing.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM likes WHERE user_id = $1 AND card_id = $2',
        [user_id, card_id]
      )
      return NextResponse.json({ liked: false })
    } else {
      // Like
      await pool.query(
        'INSERT INTO likes (user_id, card_id, created_at) VALUES ($1, $2, NOW())',
        [user_id, card_id]
      )
      
      return NextResponse.json({ liked: true })
    }
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest().catch(() => null)
    if (!session) {
      return NextResponse.json({ liked_card_ids: [] })
    }
    const user_id = session.userId

    const result = await pool.query(
      'SELECT card_id FROM likes WHERE user_id = $1',
      [user_id]
    )

    return NextResponse.json({
      liked_card_ids: result.rows.map((row) => row.card_id),
    })
  } catch (error) {
    console.error('Error fetching likes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    )
  }
}
