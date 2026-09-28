import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { scrapeSyncBearerMatches } from '@/lib/intelligence/scrapeSyncAuth'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
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
const GUEST_AI_MAX_PER_MINUTE =
  process.env.NODE_ENV === 'development' ? 120 : 6

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

/** Build the same key `resolveMemoryScopeKey` would for a signed-in user, from a userId you
 *  already have in hand (e.g. a cron job iterating specific users with no request/session). */
export function userScopeKey(userId: string): string {
  return `user:${userId}`
}

/**
 * Stable per-requester key for scoping request-lifetime in-memory caches (e.g.
 * `lib/memory/store.ts`, the per-user side of `lib/zone/injectionStore.ts`) — a warm
 * serverless instance can interleave requests from different people, so a single shared
 * module-level variable leaks one person's content into another's response. Always returns
 * a key (falls back to per-IP) so callers never need a "no identity" branch of their own.
 */
export async function resolveMemoryScopeKey(request: NextRequest): Promise<string> {
  const identity = await resolveRequestIdentity(request)
  if (identity?.kind === 'user') return userScopeKey(identity.userId)
  if (identity?.kind === 'guest') return `guest:${identity.sessionId}`
  return `anon:${getClientIdentifier(request)}`
}

/** Gate expensive AI / Firecrawl routes. Returns 401/429 response or null when allowed. */
export async function requireAiRouteAuth(request: NextRequest): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request) || gatewayTokenMatches(request)) return null
  const identity = await resolveRequestIdentity(request)
  if (!identity) return unauthorizedResponse()

  if (identity.kind === 'guest') {
    const id = getClientIdentifier(request)
    const { ok, retryAfter } = await checkRateLimitAsync(`guest-ai:${id}`, GUEST_AI_MAX_PER_MINUTE)
    if (!ok) return tooManyRequestsResponse(retryAfter)
  }

  return null
}

/** Signed-in user or service bearer — not guest-only cookies. */
export async function requireUserOrServiceBearer(
  request: NextRequest
): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request) || gatewayTokenMatches(request)) return null
  const session = await getSessionFromRequest().catch(() => null)
  if (session?.userId) return null
  return unauthorizedResponse()
}
