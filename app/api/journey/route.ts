export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { isValidJourneyId } from '@/lib/journeys'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user_id = session.userId

    const body = await request.json()
    const journey_id = typeof body?.journey_id === 'string' ? body.journey_id.trim() : ''
    const state = body?.state

    if (!journey_id || !state) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!isValidJourneyId(journey_id)) {
      return NextResponse.json({ error: 'Invalid journey' }, { status: 400 })
    }

    if (!['not_started', 'in_progress', 'completed'].includes(state)) {
      return NextResponse.json(
        { error: 'Invalid state' },
        { status: 400 }
      )
    }

    await pool.query(
      `INSERT INTO journeys (user_id, journey_key, state, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, journey_key)
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
