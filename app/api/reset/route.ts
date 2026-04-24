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

    // User can only delete their own data (cascades to related tables)
    await pool.query('DELETE FROM users WHERE id = $1', [user_id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    )
  }
}
