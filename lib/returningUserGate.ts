import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { getDbPool, isDatabaseConfigured } from '@/lib/db'
import { unsealSessionToken } from '@/lib/sessionCookieSign'
import { GUEST_SESSION_COOKIE, parseGuestSessionCookie } from '@/lib/zone/guestSession'

function guestProfileOnboardingComplete(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false
  const p = profile as Record<string, unknown>
  const pc = String(p.postcode ?? '').replace(/\s+/g, '').trim()
  return (
    Boolean(String(p.name ?? '').trim()) &&
    pc.length >= 4 &&
    Boolean(String(p.household ?? '').trim()) &&
    Boolean(String(p.home_type ?? '').trim()) &&
    Boolean(String(p.home_power ?? '').trim()) &&
    Boolean(String(p.transport ?? '').trim()) &&
    Boolean(String(p.age ?? '').trim()) &&
    Boolean(String(p.employment_status ?? '').trim()) &&
    Boolean(String(p.goal ?? '').trim())
  )
}

/**
 * Signed-in `session` cookie, or guest `zz_sid` with a completed profile in `guest_sessions`.
 * Cookie alone is not enough — incomplete onboarding stays on `/` until profile fields are filled.
 */
export async function shouldRedirectLandingToZone(request: NextRequest): Promise<boolean> {
  const skip = request.nextUrl.searchParams.get('skip')
  if (skip === '1' || skip === 'message') return false

  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value?.trim()
  if (sessionRaw && unsealSessionToken(sessionRaw)) return true

  const guestRaw = request.cookies.get(GUEST_SESSION_COOKIE)?.value
  const guestId = guestRaw ? parseGuestSessionCookie(guestRaw) : null
  if (!guestId || !isDatabaseConfigured()) return false

  try {
    const pool = getDbPool()
    const result = await pool.query(`SELECT profile FROM guest_sessions WHERE session_id = $1 LIMIT 1`, [
      guestId,
    ])
    return guestProfileOnboardingComplete(result.rows[0]?.profile)
  } catch {
    return false
  }
}
