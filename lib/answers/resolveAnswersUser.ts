import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createSession,
  getSessionFromRequest,
  setSessionCookieOnResponse,
} from '@/lib/auth'
import { readGuestSessionId } from '@/lib/requestAuth'

const PROFILE_ONLY_SESSION_DAYS = 7

export type ResolvedAnswersUser = {
  userId: string
  /** Set session cookie when auth came from client research UUID (no prior cookie). */
  attachSession: boolean
}

/** Answers writes require a signed-in session — guest cookie alone is not enough (C-1). */
export async function resolveAnswersUser(
  request: NextRequest,
  _body: Record<string, unknown>
): Promise<ResolvedAnswersUser | null> {
  void readGuestSessionId(request)
  const session = await getSessionFromRequest().catch(() => null)
  if (!session?.userId) return null
  return { userId: session.userId, attachSession: false }
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
