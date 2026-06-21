/**
 * Profile / summary locality — single server round-trip (Postcodes.io + carbon).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isRealLocalityLabel } from '@/lib/brains/summaryLogic'
import { getLocalData } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PER_MINUTE = 40

export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`profile-locality:${id}`, MAX_PER_MINUTE)
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

  const local = await getLocalData(postcode)
  if (!local) {
    return NextResponse.json({ error: 'Could not resolve postcode' }, { status: 404 })
  }

  const fromLocal = formatLocationDisplayName(local, raw || postcode).trim()
  const fromCouncil = local.council?.trim() ?? ''
  const label =
    (isRealLocalityLabel(fromLocal) ? fromLocal : '') ||
    (isRealLocalityLabel(fromCouncil) ? fromCouncil : '')

  return NextResponse.json({
    postcode,
    label,
    local,
    resolved: Boolean(label),
  })
}
