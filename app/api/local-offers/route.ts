import { NextRequest, NextResponse } from 'next/server'
import { postcodeToLatLon } from '@/lib/brains'
import { generateLocalOfferCards } from '@/lib/brains'
import { getLocalData } from '@/lib/local/getLocalData'
import { runLiveGrounding } from '@/lib/sentinel/liveGrounding'
import { requireAiRouteAuth } from '@/lib/requestAuth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Firecrawl/Gemini path — tighter than generic guest AI (6/min). */
const LOCAL_OFFERS_MAX_PER_MINUTE = 3

export async function GET(req: NextRequest) {
  const gate = await requireAiRouteAuth(req)
  if (gate) return gate

  const id = getClientIdentifier(req)
  const { ok, retryAfter } = await checkRateLimitAsync(
    `local-offers:${id}`,
    LOCAL_OFFERS_MAX_PER_MINUTE
  )
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests', items: [] },
      {
        status: 429,
        headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
      }
    )
  }

  try {
    const raw = req.nextUrl.searchParams.get('postcode')?.trim() ?? ''
    const postcode = raw.replace(/\s+/g, '').toUpperCase()
    const tenure = (req.nextUrl.searchParams.get('tenure') ?? '').toLowerCase()

    if (postcode.length < 4) {
      return NextResponse.json({ items: [] })
    }
    if (postcode.length > 12) {
      return NextResponse.json({ error: 'postcode too long', items: [] }, { status: 400 })
    }

    const coords = await postcodeToLatLon(postcode)

    if (!coords) {
      return NextResponse.json({ items: [] })
    }

    const offerCards = await generateLocalOfferCards(coords.lat, coords.lon)
    const local = await getLocalData(postcode)
    const compactPostcode = postcode
    const grounded = await runLiveGrounding({
      postcode: compactPostcode,
      tenureType: tenure === 'rent' ? 'rent' : 'own',
      local,
      genome: {},
    })
    const provenance = `Verified for ${compactPostcode} as of April 27, 2026. Source: ${grounded.source}.`

    const injectedLiveItems = [
      {
        id: `live-home-${compactPostcode.toLowerCase()}`,
        type: 'card' as const,
        variant: 'card-compact',
        title: grounded.offer_name,
        subtitle: `Live Data: ${grounded.source} | Grounded: April 27, 2026.`,
        journey_key: 'home',
        category: 'home',
        data: {
          money: `£${Math.round(grounded.save_gbp).toLocaleString('en-GB')}`,
          carbon: `${Math.max(1, Math.round(grounded.carbon_kg))} kg`,
          explanation: provenance,
          localityName: grounded.real_locality || local?.locality || local?.council || local?.region || compactPostcode,
        },
        source: grounded.source_url,
      },
    ]

    const items = [...injectedLiveItems, ...offerCards].map((o) => ({
      id: o.id,
      type: 'card' as const,
      variant: o.variant,
      title: o.title,
      subtitle: o.subtitle,
      journey_key: o.journey_key,
      category: o.category,
      data: o.data,
      source: o.source,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error fetching local offers:', error)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}
