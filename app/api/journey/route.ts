import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const body = await request.json()
    const { journey_id, state } = body

    if (!journey_id || !state) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['not_started', 'in_progress', 'completed'].includes(state)) {
      return NextResponse.json(
        { error: 'Invalid state' },
        { status: 400 }
      )
    }

    await pool.query(
      `INSERT INTO journeys (user_id, journey_id, state, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, journey_id)
       DO UPDATE SET state = $3, updated_at = NOW()`,
      [user_id, journey_id, state]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating journey:', error)
    return NextResponse.json(
      { error: 'Failed to update journey' },
      { status: 500 }
    )
  }
}
