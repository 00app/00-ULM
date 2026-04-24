import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionCookieAttributes } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, postcode, household, home_type, transport_baseline, age_group } = body

    const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!emailTrim || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, postcode, household, home_type, transport_baseline, age_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, postcode, household, home_type, transport_baseline, age_group, created_at`,
      [
        emailTrim,
        passwordHash,
        name ?? null,
        postcode ?? null,
        household ?? null,
        home_type ?? null,
        transport_baseline ?? null,
        age_group ?? null,
      ]
    )
    const user = result.rows[0]

    const token = await createSession(user.id)
    const { name: cookieName, options } = getSessionCookieAttributes()
    const res = NextResponse.json({ user_id: user.id })
    res.cookies.set(cookieName, token, options as any)
    return res
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Sign up failed' }, { status: 500 })
  }
}
