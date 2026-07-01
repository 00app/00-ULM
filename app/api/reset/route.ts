export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { GUEST_SESSION_COOKIE } from '@/lib/zone/guestSession'
import { parseGuestSessionCookie } from '@/lib/sessionCookieSign'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()

    // Clear guest session (visited cards, profile) regardless of signed-in state
    const guestRaw = request.cookies.get(GUEST_SESSION_COOKIE)?.value
    const guestSid = parseGuestSessionCookie(guestRaw)
    if (guestSid) {
      await pool.query('DELETE FROM guest_sessions WHERE session_id = $1', [guestSid])
    }

    if (session?.userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [session.userId])
    }

    const response = NextResponse.json({ success: true })
    // Expire the guest cookie so a fresh one is minted on next visit
    response.cookies.set(GUEST_SESSION_COOKIE, '', { maxAge: 0, path: '/' })
    return response
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    )
  }
}
