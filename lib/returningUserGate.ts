import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'
import { getDbPool, isDatabaseConfigured } from '@/lib/db'
import {
  guestProfileOnboardingComplete,
  userRowOnboardingComplete,
} from '@/lib/profile/onboardingComplete'
import { unsealSessionToken } from '@/lib/sessionCookieSign'
import { GUEST_SESSION_COOKIE, parseGuestSessionCookie } from '@/lib/zone/guestSession'

/**
 * Signed-in session with complete Neon profile, or guest `zz_sid` with completed guest_sessions profile.
 * Cookie alone is not enough — incomplete onboarding stays on `/` until profile fields are filled.
 */
export async function shouldRedirectLandingToZone(request: NextRequest): Promise<boolean> {
  const skip = request.nextUrl.searchParams.get('skip')
  if (skip === '1' || skip === 'message') return false
  return isRequestSessionOnboardingComplete(request)
}

/**
 * Same DB-backed completeness check as the landing gate, applied to `/profile`.
 * Bypassed when `q`/`returnTo` are present — that's the deliberate Settings single-field
 * edit deep link, not a fresh onboarding visit, and must not redirect away.
 */
export async function shouldRedirectProfileToZone(request: NextRequest): Promise<boolean> {
  const skip = request.nextUrl.searchParams.get('skip')
  if (skip === '1' || skip === 'message') return false
  if (request.nextUrl.searchParams.get('q')) return false
  if (request.nextUrl.searchParams.get('returnTo')) return false
  return isRequestSessionOnboardingComplete(request)
}

async function isRequestSessionOnboardingComplete(request: NextRequest): Promise<boolean> {
  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value?.trim()
  const token = sessionRaw ? unsealSessionToken(sessionRaw) : null
  if (token && isDatabaseConfigured()) {
    try {
      const pool = getDbPool()
      const sessionRes = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now() LIMIT 1`,
        [token]
      )
      const userId = sessionRes.rows[0]?.user_id
      if (userId) {
        const userRes = await pool.query<{
          name: string | null
          postcode: string | null
          household: string | null
          home_type: string | null
          transport_baseline: string | null
          employment_status: string | null
          age_group: string | null
          user_genome: Record<string, unknown> | null
        }>(
          `SELECT name, postcode, household, home_type, transport_baseline, employment_status, age_group, user_genome
           FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        )
        return userRowOnboardingComplete(userRes.rows[0])
      }
    } catch {
      return false
    }
  }

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
