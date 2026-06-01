import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { scrapeSyncBearerMatches } from '@/lib/intelligence/scrapeSyncAuth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import {
  GUEST_SESSION_COOKIE,
  guestIpHashFromRequest,
  parseGuestSessionCookie,
} from '@/lib/zone/guestSession'
import { ensureGuestSessionRow } from '@/lib/zone/ensureGuestSessionRow'

export type RequestIdentity =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; sessionId: string }

/** Guest-only LLM / scrape paths — tighter than signed-in users (per-IP, in-memory). */
const GUEST_AI_MAX_PER_MINUTE = 6

/** Server-issued guest cookie (`zz_sid`) — not localStorage. */
export function readGuestSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(GUEST_SESSION_COOKIE)?.value
  return parseGuestSessionCookie(value)
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function tooManyRequestsResponse(retryAfter?: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    }
  )
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

/** Gate expensive AI / Firecrawl routes. Returns 401/429 response or null when allowed. */
export async function requireAiRouteAuth(request: NextRequest): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request)) return null
  const identity = await resolveRequestIdentity(request)
  if (!identity) return unauthorizedResponse()

  if (identity.kind === 'guest') {
    const id = getClientIdentifier(request)
    const { ok, retryAfter } = checkRateLimit(`guest-ai:${id}`, GUEST_AI_MAX_PER_MINUTE)
    if (!ok) return tooManyRequestsResponse(retryAfter)
  }

  return null
}

/** Signed-in user or service bearer — not guest-only cookies. */
export async function requireUserOrServiceBearer(
  request: NextRequest
): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request)) return null
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return null
  return unauthorizedResponse()
}
