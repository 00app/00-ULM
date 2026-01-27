import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, postcode, household, home_type, transport } = body

    if (!name || !postcode || !household || !home_type || !transport) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user exists (by name/postcode combination or create new)
    // For simplicity, we'll create a new user each time
    // In production, you'd want to identify users by session/auth
    const result = await pool.query(
      `INSERT INTO users (name, postcode, household, home_type, transport)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, postcode, household, home_type, transport, created_at`,
      [name, postcode, household, home_type, transport]
    )

    return NextResponse.json({
      user: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create user',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
