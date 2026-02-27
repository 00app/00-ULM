import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionCookieAttributes } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, postcode, household, home_type, transport, age_group } = body

    if (!name || !postcode || !household || !home_type || !transport) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO users (name, postcode, household, home_type, transport_baseline, age_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, postcode, household, home_type, transport_baseline, age_group, created_at`,
      [name, postcode, household, home_type, transport, age_group ?? null]
    )
    const user = result.rows[0]
    const token = await createSession(user.id)
    const { name: cookieName, options } = getSessionCookieAttributes()
    const res = NextResponse.json({ user })
    res.cookies.set(cookieName, token, options as Record<string, unknown>)
    return res
  } catch (error: unknown) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create user', details: message },
      { status: 500 }
    )
  }
}
