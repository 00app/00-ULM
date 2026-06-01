import type { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { GUEST_SESSION_COOKIE, getGuestSessionCookieOptions, parseGuestSessionCookie } from '@/lib/zone/guestSession'
import { isSessionSigningConfigured, sealGuestSessionId } from '@/lib/sessionCookieSign'
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

  // Production requires SESSION_SECRET to sign cookies — never 500 the whole site if unset.
  if (!isSessionSigningConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[proxy] SESSION_SECRET missing (≥16 chars) — guest cookie skipped')
    }
    return response
  }

  try {
    response.cookies.set(
      GUEST_SESSION_COOKIE,
      sealGuestSessionId(mintGuestSessionId()),
      getGuestSessionCookieOptions()
    )
  } catch (err) {
    console.error('[proxy] guest cookie mint failed:', err instanceof Error ? err.message : err)
  }
  return response
}
