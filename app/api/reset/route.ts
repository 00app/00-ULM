export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { SESSION_COOKIE, getSessionCookieAttributes } from '@/lib/auth'
import { GUEST_SESSION_COOKIE, getGuestSessionCookieOptions, parseGuestSessionCookie } from '@/lib/zone/guestSession'
import { unsealSessionToken } from '@/lib/sessionCookieSign'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true })

    // --- Clear guest session (the common case — no sign-in required) ---
    const guestRaw = request.cookies.get(GUEST_SESSION_COOKIE)?.value
    const guestSid = parseGuestSessionCookie(guestRaw)
    if (guestSid) {
      await pool.query('DELETE FROM guest_sessions WHERE session_id = $1', [guestSid])
    }
    // Expire zz_sid cookie with matching attributes so the browser drops it
    response.cookies.set(GUEST_SESSION_COOKIE, '', { ...getGuestSessionCookieOptions(0), path: '/' })

    // --- Clear signed-in user if present ---
    try {
      const cookieStore = await cookies()
      const sessionRaw = cookieStore.get(SESSION_COOKIE)?.value ?? null
      const sessionToken = sessionRaw ? unsealSessionToken(sessionRaw) : null
      if (sessionToken) {
        const result = await pool.query(
          `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`,
          [sessionToken]
        )
        const userId = result.rows[0]?.user_id
        if (userId) {
          await pool.query('DELETE FROM users WHERE id = $1', [userId])
        }
        await pool.query('DELETE FROM sessions WHERE token = $1', [sessionToken])
      }
    } catch {
      // no signed-in session — fine
    }
    // Expire the session cookie with matching attributes
    const { options: sessionOpts } = getSessionCookieAttributes(0)
    response.cookies.set(SESSION_COOKIE, '', sessionOpts)

    return response
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 })
  }
}
