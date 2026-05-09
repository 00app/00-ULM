import { NextRequest, NextResponse } from 'next/server'
import { postcodeToLatLon } from '@/lib/brains'
import { generateLocalOfferCards } from '@/lib/brains'
import { getLocalData } from '@/lib/local/getLocalData'
import { runLiveGrounding } from '@/lib/sentinel/liveGrounding'

// This route is always dynamic (uses nextUrl.searchParams)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const postcode = req.nextUrl.searchParams.get('postcode')
    const tenure = (req.nextUrl.searchParams.get('tenure') ?? '').toLowerCase()
    
    if (!postcode) {
      return NextResponse.json({ items: [] })
    }

    // Geocode postcode to coordinates using brains layer
    const coords = await postcodeToLatLon(postcode)
    
    if (!coords) {
      return NextResponse.json({ items: [] })
    }

    // Generate local offer cards using brains layer
    const offerCards = await generateLocalOfferCards(coords.lat, coords.lon)
    const local = await getLocalData(postcode)
    const compactPostcode = postcode.replace(/\s+/g, '').toUpperCase()
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

    // Map to ZoneItem format
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
