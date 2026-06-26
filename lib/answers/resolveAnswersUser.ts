import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createSession,
  getSessionFromRequest,
  setSessionCookieOnResponse,
} from '@/lib/auth'
import pool from '@/lib/db'
import { readGuestSessionId } from '@/lib/requestAuth'
import { resolveUserIdFromRestoreProof } from '@/lib/sessionRestoreProof'

const PROFILE_ONLY_SESSION_DAYS = 7

export type ResolvedAnswersUser = {
  userId: string
  /** Set session cookie when auth came from HMAC restore proof (no prior cookie). */
  attachSession: boolean
}

/**
 * Answers writes require a signed-in session or valid HMAC `restore_proof`.
 * Bare UUID without proof is rejected.
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
  const userId = resolveUserIdFromRestoreProof(restoreProof)
  if (!userId) return null

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
