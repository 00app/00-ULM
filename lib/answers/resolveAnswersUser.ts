import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import {
  createSession,
  getSessionCookieAttributes,
  getSessionFromRequest,
} from '@/lib/auth'
import { ensureGaryDemoUser } from '@/lib/db/ensureGaryDemoUser'
import { GARY_RESEARCH_USER_ID, isValidResearchUserId } from '@/lib/zone/garyMode'

const PROFILE_ONLY_SESSION_DAYS = 7

export type ResolvedAnswersUser = {
  userId: string
  /** Set session cookie when auth came from client research UUID (no prior cookie). */
  attachSession: boolean
}

export async function resolveAnswersUser(
  request: NextRequest,
  body: Record<string, unknown>
): Promise<ResolvedAnswersUser | null> {
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) {
    return { userId: session.userId, attachSession: false }
  }

  const bodyId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!isValidResearchUserId(bodyId)) return null

  const postcode =
    typeof body.postcode === 'string' ? body.postcode.replace(/\s+/g, '').trim().toUpperCase() : ''

  if (bodyId === GARY_RESEARCH_USER_ID) {
    if (postcode.length >= 4) {
      await ensureGaryDemoUser(postcode).catch(() => null)
    }
    return { userId: bodyId, attachSession: true }
  }

  try {
    const exists = await pool.query(`SELECT id FROM users WHERE id = $1::uuid LIMIT 1`, [bodyId])
    if (!exists.rows?.length) return null
    return { userId: bodyId, attachSession: true }
  } catch {
    return null
  }
}

export function attachSessionCookieToResponse(
  res: NextResponse,
  userId: string
): Promise<NextResponse> {
  return createSession(userId, PROFILE_ONLY_SESSION_DAYS).then((token) => {
    const { name: cookieName, options } = getSessionCookieAttributes(
      PROFILE_ONLY_SESSION_DAYS * 24 * 60 * 60
    )
    res.cookies.set(cookieName, token, options)
    return res
  })
}
