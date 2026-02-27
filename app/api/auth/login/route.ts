import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, getSessionCookieAttributes } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!emailTrim || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [emailTrim]
    )
    const user = result.rows[0]
    if (!user?.password_hash) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    }

    const token = await createSession(user.id)
    const { name: cookieName, options } = getSessionCookieAttributes()
    const res = NextResponse.json({ user_id: user.id })
    res.cookies.set(cookieName, token, options as any)
    return res
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Log in failed' }, { status: 500 })
  }
}
