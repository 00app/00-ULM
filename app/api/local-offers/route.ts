import { NextRequest, NextResponse } from 'next/server'
import { postcodeToLatLon } from '@/lib/brains'
import { generateLocalOfferCards } from '@/lib/brains'

// This route is always dynamic (uses nextUrl.searchParams)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const postcode = req.nextUrl.searchParams.get('postcode')
    
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

    // Map to ZoneItem format
    const items = offerCards.map((o) => ({
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
