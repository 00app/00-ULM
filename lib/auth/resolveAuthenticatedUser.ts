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

export type ResolvedAuthenticatedUser = {
  userId: string
  /** Set session cookie when auth came from HMAC restore proof (no prior cookie). */
  attachSession: boolean
}

function restoreProofFromBody(body: Record<string, unknown>): string {
  const raw = body.restore_proof ?? body.restoreProof
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * Signed-in session or valid HMAC `restore_proof` in POST JSON body.
 * Bare UUID without proof is rejected.
 */
export async function resolveAuthenticatedUser(
  request: NextRequest,
  body: Record<string, unknown> = {}
): Promise<ResolvedAuthenticatedUser | null> {
  void readGuestSessionId(request)
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return { userId: session.userId, attachSession: false }

  const userId = resolveUserIdFromRestoreProof(restoreProofFromBody(body))
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

export async function finalizeAuthenticatedResponse(
  res: NextResponse,
  auth: ResolvedAuthenticatedUser
): Promise<NextResponse> {
  if (auth.attachSession) {
    return attachSessionCookieToResponse(res, auth.userId)
  }
  return res
}
