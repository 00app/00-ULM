import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { scrapeSyncBearerMatches } from '@/lib/intelligence/scrapeSyncAuth'
import {
  GUEST_SESSION_COOKIE,
  guestIpHashFromRequest,
  parseGuestSessionCookie,
} from '@/lib/zone/guestSession'
import { ensureGuestSessionRow } from '@/lib/zone/ensureGuestSessionRow'

export type RequestIdentity =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; sessionId: string }

/** Server-issued guest cookie (`zz_sid`) — not localStorage. */
export function readGuestSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(GUEST_SESSION_COOKIE)?.value
  return parseGuestSessionCookie(value)
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

/** Hermes/cron bearer OR signed-in user OR server guest cookie (`zz_sid`). */
export async function resolveRequestIdentity(
  request: NextRequest
): Promise<RequestIdentity | null> {
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return { kind: 'user', userId: session.userId }

  const guestId = readGuestSessionId(request)
  if (!guestId) return null

  await ensureGuestSessionRow(guestId, guestIpHashFromRequest(request)).catch(() => {
    /* non-fatal — cookie still valid */
  })
  return { kind: 'guest', sessionId: guestId }
}

/** Gate expensive AI / Firecrawl routes. Returns 401 response or null when allowed. */
export async function requireAiRouteAuth(request: NextRequest): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request)) return null
  const identity = await resolveRequestIdentity(request)
  if (!identity) return unauthorizedResponse()
  return null
}
