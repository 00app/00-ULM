import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// This route is always dynamic (uses request URL/search params)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const journey_id = searchParams.get('journey_id')
    const type = searchParams.get('type')

    let query = 'SELECT * FROM cards WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (journey_id) {
      query += ` AND journey_id = $${paramIndex}`
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
