import { NextRequest, NextResponse } from 'next/server'
import { fetchLocalityFromNominatim, formatPostcodeFallback } from '@/lib/geocode/resolvePostcodeLocality'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GEOCODE_MAX_PER_MINUTE = 60

export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`geocode-postcode:${id}`, GEOCODE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }

  const raw = request.nextUrl.searchParams.get('postcode')?.trim() ?? ''
  const postcode = raw.replace(/\s+/g, '').toUpperCase()
  if (postcode.length < 4) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  if (postcode.length > 12) {
    return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
  }

  const locality = await fetchLocalityFromNominatim(postcode)
  return NextResponse.json({
    postcode,
    locality: locality ?? formatPostcodeFallback(raw || postcode),
    resolved: Boolean(locality),
  })
}
