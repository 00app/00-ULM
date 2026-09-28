import { NextRequest, NextResponse } from 'next/server'
import { getLocalData } from '@/lib/local/getLocalData'
import { buildFallbackSnapshot, fetchLivingPulseSnapshot } from '@/lib/logic/pulse'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { tooManyRequestsResponse } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PULSE_LIVING_MAX_PER_MINUTE = 30

/** Public read — Ofgem / grid scraping stays server-side (no browser → ofgem.gov.uk). Every
 *  other public route here (geocode, local-intelligence, profile/locality, brain) carries a
 *  rate limit; this one didn't, despite triggering a live scrape on every hit. */
export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`pulse-living:${id}`, PULSE_LIVING_MAX_PER_MINUTE)
  if (!ok) return tooManyRequestsResponse(retryAfter)

  const postcode =
    request.nextUrl.searchParams.get('postcode')?.replace(/\s+/g, '').trim().toUpperCase() ?? ''
  if (postcode.length < 4) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  if (postcode.length > 12) {
    return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
  }
  const local = await getLocalData(postcode).catch(() => null)
  try {
    const snapshot = await fetchLivingPulseSnapshot(postcode, local)
    return NextResponse.json(snapshot)
  } catch (e) {
    console.error('[pulse/living] GET error:', e)
    return NextResponse.json(buildFallbackSnapshot(local, postcode))
  }
}
