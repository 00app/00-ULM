import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createSession,
  getSessionFromRequest,
  setSessionCookieOnResponse,
} from '@/lib/auth'
import pool from '@/lib/db'
import { readGuestSessionId } from '@/lib/requestAuth'

const PROFILE_ONLY_SESSION_DAYS = 7
const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ResolvedAnswersUser = {
  userId: string
  /** Set session cookie when auth came from client research UUID (no prior cookie). */
  attachSession: boolean
}

/** Answers writes require a signed-in session — guest cookie alone is not enough (C-1). */
export async function resolveAnswersUser(
  request: NextRequest,
  body: Record<string, unknown>
): Promise<ResolvedAnswersUser | null> {
  void readGuestSessionId(request)
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return { userId: session.userId, attachSession: false }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!USER_ID_RE.test(userId)) return null
  const found = await pool.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [userId])
  if (!found.rows?.length) return null
  return { userId, attachSession: true }
}

export function attachSessionCookieToResponse(
  res: NextResponse,
  userId: string
): Promise<NextResponse> {
  return createSession(userId, PROFILE_ONLY_SESSION_DAYS).then((token) => {
    setSessionCookieOnResponse(res, token, PROFILE_ONLY_SESSION_DAYS * 24 * 60 * 60)
    return res
  })
}
