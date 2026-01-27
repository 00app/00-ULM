import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing user_id' },
        { status: 400 }
      )
    }

    // Delete user data (cascades to related tables)
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
