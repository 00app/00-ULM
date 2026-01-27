import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, card_id } = body

    if (!user_id || !card_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id' },
        { status: 400 }
      )
    }

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
