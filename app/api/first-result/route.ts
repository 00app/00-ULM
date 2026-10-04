import { NextRequest, NextResponse } from 'next/server'
import { compactUkPostcode, isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { resolveFirstResult } from '@/lib/entry/firstResult'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { tooManyRequestsResponse } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIRST_RESULT_MAX_PER_MINUTE = 20

/** true = exists, false = confirmed not a real postcode, null = could not check. */
async function postcodeExists(compact: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}/validate`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: boolean }
    return typeof json.result === 'boolean' ? json.result : null
  } catch {
    return null
  }
}

/** Public read: postcode in, ONE verified figure out (or `result: null` — never an invented one). */
export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`first-result:${id}`, FIRST_RESULT_MAX_PER_MINUTE)
  if (!ok) return tooManyRequestsResponse(retryAfter)

  const raw = request.nextUrl.searchParams.get('postcode')?.trim() ?? ''
  if (!isValidUkPostcode(raw)) {
    return NextResponse.json({ error: 'valid UK postcode required' }, { status: 400 })
  }
  const compact = compactUkPostcode(raw)
  const spaced = `${compact.slice(0, -3)} ${compact.slice(-3)}`
  // Format-valid is not the same as real: ZZ99 9ZZ passes the regex, then maps to a default
  // region and would show that region's figure as "yours". Confirm it exists first. If the
  // lookup service itself is unreachable we cannot confirm either way, so we carry on rather
  // than block the flow (the region mapping is the same prefix lookup used app-wide).
  const exists = await postcodeExists(compact)
  if (exists === false) {
    return NextResponse.json({ error: 'postcode not found' }, { status: 404 })
  }
  const result = await resolveFirstResult(spaced).catch(() => null)
  return NextResponse.json({ postcode: spaced, result })
}
