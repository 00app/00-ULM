import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createSession, setSessionCookieOnResponse } from '@/lib/auth'
import { checkLoginRateLimit, getClientIp, recordLoginAttempt } from '@/lib/rateLimit'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!emailTrim || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const rateLimited = checkLoginRateLimit(ip, emailTrim)
    if (rateLimited) {
      return NextResponse.json({ error: rateLimited }, { status: 429 })
    }

    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [emailTrim]
    )
    const user = result.rows[0]
    if (!user?.password_hash) {
      recordLoginAttempt(ip, emailTrim, false)
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      recordLoginAttempt(ip, emailTrim, false)
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    }

    recordLoginAttempt(ip, emailTrim, true)
    const token = await createSession(user.id)
    const res = NextResponse.json({ user_id: user.id })
    setSessionCookieOnResponse(res, token)
    return res
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Log in failed' }, { status: 500 })
  }
}
