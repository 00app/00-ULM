import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createSession,
  getSessionFromRequest,
  setSessionCookieOnResponse,
} from '@/lib/auth'
import pool from '@/lib/db'
import { readGuestSessionId } from '@/lib/requestAuth'
import {
  allowInsecureDevSessionRestore,
  resolveUserIdFromRestoreProof,
  verifySessionRestoreProof,
} from '@/lib/sessionRestoreProof'

const PROFILE_ONLY_SESSION_DAYS = 7
const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ResolvedAnswersUser = {
  userId: string
  /** Set session cookie when auth came from HMAC restore proof (no prior cookie). */
  attachSession: boolean
}

/**
 * Answers writes require a signed-in session or `user_id` + valid `restore_proof`
 * (same bar as POST /api/auth/restore-session). Bare UUID is rejected.
 */
export async function resolveAnswersUser(
  request: NextRequest,
  body: Record<string, unknown>
): Promise<ResolvedAnswersUser | null> {
  void readGuestSessionId(request)
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return { userId: session.userId, attachSession: false }

  const restoreProof =
    typeof body.restore_proof === 'string' ? body.restore_proof.trim() : ''

  const verifiedFromProof = resolveUserIdFromRestoreProof(restoreProof)
  let userId: string | null = verifiedFromProof
  if (!userId) {
    const fromBody = typeof body.user_id === 'string' ? body.user_id.trim() : ''
    if (!USER_ID_RE.test(fromBody)) return null
    const devBypass = allowInsecureDevSessionRestore()
    if (!devBypass && !verifySessionRestoreProof(fromBody, restoreProof)) return null
    userId = fromBody
  }

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
