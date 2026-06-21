/**
 * Reverse geocode (lat/lon → place name) via OpenStreetMap Nominatim.
 * No API key required. Used for Summary "AUDIT LOCALIZED TO: City, Postcode".
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse'
const GEOCODE_MAX_PER_MINUTE = 60

function parseCoord(value: string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

export async function GET(req: NextRequest) {
  const id = getClientIdentifier(req)
  const { ok, retryAfter } = await checkRateLimitAsync(`geocode:${id}`, GEOCODE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined })
  }

  const latParam = req.nextUrl.searchParams.get('lat')
  const lonParam = req.nextUrl.searchParams.get('lon')

  if (!latParam || !lonParam) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  const lat = parseCoord(latParam)
  const lon = parseCoord(lonParam)
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'lat and lon must be valid numbers (lat -90..90, lon -180..180)' }, { status: 400 })
  }

  const url = `${NOMINATIM_BASE}?format=jsonv2&lat=${lat}&lon=${lon}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ZeroZeroApp/1.0 (https://github.com/zero-zero; contact@yourdomain.com)',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: 'Nominatim request failed', details: text.slice(0, 200) },
        { status: 502 }
      )
    }
    const data = (await res.json()) as {
      address?: {
        city?: string
        town?: string
        village?: string
        municipality?: string
        postcode?: string
        state?: string
        country?: string
      }
    }
    const addr = data?.address
    if (!addr) {
      return NextResponse.json({ error: 'No result' }, { status: 404 })
    }
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
    const postcode = addr.postcode ?? ''
    return NextResponse.json({
      city,
      postcode,
      state: addr.state ?? '',
      country: addr.country ?? '',
      formatted: [city, postcode].filter(Boolean).join(', '),
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Geocode failed', details: String(e) },
      { status: 500 }
    )
  }
}
