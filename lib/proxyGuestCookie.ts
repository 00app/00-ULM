import type { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { GUEST_SESSION_COOKIE, getGuestSessionCookieOptions, parseGuestSessionCookie } from '@/lib/zone/guestSession'
import { sealGuestSessionId } from '@/lib/sessionCookieSign'
import { SESSION_COOKIE } from '@/lib/auth'

function mintGuestSessionId(): string {
  return `sess_${crypto.randomBytes(24).toString('hex')}`
}

/**
 * Mint HTTP-only `zz_sid` on first visit when no user session exists.
 * Neon row is created lazily on first authenticated API touch (`ensureGuestSessionRow`).
 */
export function attachGuestSessionCookieIfMissing(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const hasUserSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value?.trim())
  const guest = parseGuestSessionCookie(request.cookies.get(GUEST_SESSION_COOKIE)?.value)
  if (hasUserSession || guest) return response

  response.cookies.set(GUEST_SESSION_COOKIE, sealGuestSessionId(mintGuestSessionId()), getGuestSessionCookieOptions())
  return response
}
