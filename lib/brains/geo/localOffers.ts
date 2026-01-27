/**
 * Convert OpenStreetMap places to Zone card format
 * Creates card-compact cards for local offers
 */

import { fetchLocalPlaces, OSMPlace } from './openstreetmap'

export interface LocalOfferCard {
  id: string
  variant: 'card-compact'
  title: string
  subtitle?: string
  journey_key?: string
  category: string
  data: {
    carbon?: string
    money?: string
  }
  source: string // OpenStreetMap URL
  tone: 'blue' // DEEP bg / ICE text
}

/**
 * Convert OSM places to local offer cards
 */
export async function generateLocalOfferCards(
  lat: number,
  lon: number
): Promise<LocalOfferCard[]> {
  const tags = ['organic', 'second_hand', 'repair', 'bicycle', 'charity', 'library']
  const places = await fetchLocalPlaces(lat, lon, tags, { radius: 3000, limit: 6 })

  return places.map((place: OSMPlace, index: number) => ({
    id: place.id,
    variant: 'card-compact' as const,
    title: place.name.toLowerCase(),
    // Local offers are closest to the "shopping" journey category
    category: 'shopping',
    data: {
      // Local offers don't have carbon/money data
    },
    source: `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`,
    tone: 'blue' as const, // DEEP bg / ICE text
  }))
}
