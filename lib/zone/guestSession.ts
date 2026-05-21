/**
 * Anonymous session (`zz_sid` cookie) — profile, answers, and visit breadcrumbs without login.
 */

import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export const GUEST_SESSION_COOKIE = 'zz_sid'
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 365

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
  if (cookie && cookie.length >= 16 && cookie.length <= 128) return cookie
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
