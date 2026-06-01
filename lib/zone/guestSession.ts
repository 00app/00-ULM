/**
 * Anonymous server session (`zz_sid` HTTP-only cookie) — profile, answers, visit breadcrumbs without login.
 * Audit alias: server "zz_session" identity; never use localStorage for this.
 */

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import crypto from 'crypto'
import { isSessionSigningConfigured, sealGuestSessionId, unsealGuestSessionId } from '@/lib/sessionCookieSign'

export const GUEST_SESSION_COOKIE = 'zz_sid'
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365

export function getGuestSessionCookieOptions(maxAge = GUEST_SESSION_MAX_AGE) {
  return {
    path: '/',
    maxAge,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
  }
}

export function setGuestSessionCookie(res: NextResponse, sessionId: string): void {
  if (!isSessionSigningConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[guestSession] SESSION_SECRET missing (≥16 chars) — zz_sid cookie skipped')
    }
    return
  }
  try {
    res.cookies.set(GUEST_SESSION_COOKIE, sealGuestSessionId(sessionId), getGuestSessionCookieOptions())
  } catch (err) {
    console.error('[guestSession] cookie set failed:', err instanceof Error ? err.message : err)
  }
}

export function parseGuestSessionCookie(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  return unsealGuestSessionId(raw.trim())
}

export function hashGuestIp(ip: string): string {
  let h = 0
  const s = ip.trim()
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return `ip_${Math.abs(h).toString(36)}`
}

export function resolveGuestSessionId(request: NextRequest): string {
  const cookie = request.cookies.get(GUEST_SESSION_COOKIE)?.value?.trim()
  const unsealed = cookie ? unsealGuestSessionId(cookie) : null
  if (unsealed) return unsealed
  return `sess_${crypto.randomBytes(24).toString('hex')}`
}

export function guestIpHashFromRequest(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')?.trim()
  if (!ip) return null
  return hashGuestIp(ip)
}

export function normaliseVisitedCardIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim().slice(0, 256))
  }
  return [...new Set(out)]
}

export function normaliseVisitedJourneyKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim().toLowerCase().slice(0, 64))
  }
  return [...new Set(out)]
}
