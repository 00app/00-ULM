import { NextRequest, NextResponse } from 'next/server'
import {
  finalizeAuthenticatedResponse,
  resolveAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'
import { mergeUserGenomeBankConnection } from '@/lib/db/neon'
import { parseBankState } from '@/lib/bank/connectionState'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { getSiteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

const BANK_STATE_MAX_PER_MINUTE = 20

/** Same defence-in-depth origin check as /api/reset. */
function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') ?? request.headers.get('referer')
  if (!origin) return true
  try {
    const requestHost = new URL(origin).host
    const siteHost = new URL(getSiteUrl()).host
    return requestHost === siteHost || requestHost === request.headers.get('host')
  } catch {
    return false
  }
}

/**
 * POST { status: 'none'|'sample'|'live', snoozedUntil?: ISO|null } — signed-in users only.
 * Stores connection STATUS only (never transactions, tokens or account data).
 */
export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`profile-bank:${id}`, BANK_STATE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const auth = await resolveAuthenticatedUser(request, bodyObj)
  if (!auth?.userId) {
    return NextResponse.json({ error: 'Sign in to save this' }, { status: 401 })
  }
  const state = parseBankState(bodyObj)
  await mergeUserGenomeBankConnection(auth.userId, state)
  const res = NextResponse.json({ ok: true, bank_connection: state })
  return finalizeAuthenticatedResponse(res, auth)
}
