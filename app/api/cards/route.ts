import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { isValidJourneyId } from '@/lib/journeys'

// Allowed card types (must match DB CHECK constraint)
const ALLOWED_CARD_TYPES = ['cheapest', 'greenest', 'balance', 'tip'] as const

// This route is always dynamic (uses request URL/search params)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const journey_id = searchParams.get('journey_id')?.trim() ?? ''
    const typeParam = searchParams.get('type')?.trim() ?? ''

    if (journey_id && !isValidJourneyId(journey_id)) {
      return NextResponse.json({ error: 'Invalid journey_id' }, { status: 400 })
    }

    const type =
      typeParam && ALLOWED_CARD_TYPES.includes(typeParam as (typeof ALLOWED_CARD_TYPES)[number])
        ? typeParam
        : ''

    let query = 'SELECT * FROM cards WHERE 1=1'
    const params: string[] = []
    let paramIndex = 1

    if (journey_id) {
      query += ` AND journey_key = $${paramIndex}`
      params.push(journey_id)
      paramIndex++
    }

    if (type) {
      query += ` AND type = $${paramIndex}`
      params.push(type)
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)

    return NextResponse.json({
      cards: result.rows,
    })
  } catch (error) {
    console.error('Error fetching cards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}
