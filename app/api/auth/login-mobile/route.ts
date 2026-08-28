export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'
import { createSession, setSessionCookieOnResponse } from '@/lib/auth'
import { checkLoginRateLimit, getClientIp, recordLoginAttempt } from '@/lib/rateLimit'
import { normalizeMobileE164 } from '@/lib/messaging/ukMobile'
import { withRestoreProof } from '@/lib/sessionRestoreProof'

/**
 * Sibling of /api/auth/login for accounts that set the onboarding password (app/profile
 * ProfilePageClient.tsx's password step) but never collected an email — the only credential
 * on file for them is mobile + password. Same session/cookie/rate-limit shape as email login,
 * just keyed on the normalised mobile number instead. `mobile` has no unique constraint (it was
 * never meant as a login identifier before this), so the lookup is scoped to password-protected
 * rows and takes the most recent if more than one somehow shares a number — same defensive
 * pattern as the name+postcode reattachment lookup in /api/user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mobile, password } = body

    const mobileNorm =
      typeof mobile === 'string' ? normalizeMobileE164(mobile) : null
    if (!mobileNorm || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'mobile number and password required' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const rateLimited = checkLoginRateLimit(ip, mobileNorm)
    if (rateLimited) {
      return NextResponse.json({ error: rateLimited }, { status: 429 })
    }

    const result = await pool.query(
      `SELECT id, password_hash FROM users
       WHERE mobile = $1 AND password_hash IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [mobileNorm]
    )
    const user = result.rows[0]
    if (!user?.password_hash) {
      recordLoginAttempt(ip, mobileNorm, false)
      return NextResponse.json({ error: 'wrong mobile number or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      recordLoginAttempt(ip, mobileNorm, false)
      return NextResponse.json({ error: 'wrong mobile number or password' }, { status: 401 })
    }

    recordLoginAttempt(ip, mobileNorm, true)
    const token = await createSession(user.id)
    const res = NextResponse.json(withRestoreProof({ user_id: user.id }, user.id))
    setSessionCookieOnResponse(res, token)
    return res
  } catch (error) {
    console.error('Login (mobile) error:', error)
    return NextResponse.json({ error: 'Log in failed' }, { status: 500 })
  }
}
