/**
 * OpenStreetMap Overpass API integration
 * Fetch local places by tags (organic, second_hand, vegan, repair, charity, etc.)
 */

export interface OSMPlace {
  id: string
  name: string
  type: 'node' | 'way' | 'relation'
  lat: number
  lon: number
  tags: Record<string, string>
}

export interface FetchLocalPlacesOptions {
  radius?: number // meters, default 3000
  limit?: number // default 20
}

/**
 * Fetch local places from OpenStreetMap using Overpass API
 * Supports tags like: organic, second_hand, vegan, repair, charity
 */
export async function fetchLocalPlaces(
  lat: number,
  lon: number,
  tags: string[],
  options: FetchLocalPlacesOptions = {}
): Promise<OSMPlace[]> {
  const radius = options.radius || 3000
  const limit = options.limit || 20

  // Build Overpass query for shop and amenity tags
  const shopTags = tags.filter(tag => 
    ['organic', 'second_hand', 'repair', 'bicycle', 'clothes', 'charity'].includes(tag)
  )
  const amenityTags = tags.filter(tag => 
    ['bicycle_repair_station', 'library', 'community_centre'].includes(tag)
  )

  let query = '[out:json][timeout:25];('

  // Add shop queries
  if (shopTags.length > 0) {
    const shopRegex = shopTags.join('|')
    query += `\n  node["shop"~"${shopRegex}"](around:${radius},${lat},${lon});`
  }

  // Add amenity queries
  if (amenityTags.length > 0) {
    const amenityRegex = amenityTags.join('|')
    query += `\n  node["amenity"~"${amenityRegex}"](around:${radius},${lat},${lon});`
  }

  // Add craft queries for repair/recycling
  if (tags.includes('repair') || tags.includes('recycling')) {
    query += `\n  node["craft"~"repair|recycling"](around:${radius},${lat},${lon});`
  }

  query += '\n);\nout body;'

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'Zero Zero App',
      },
      body: query,
    })

    if (!res.ok) {
      throw new Error(`Overpass API error: ${res.status}`)
    }

    const data = await res.json()

    if (!data?.elements) return []

    return data.elements
      .filter((el: any) => el.tags?.name) // Only include named places
      .slice(0, limit)
      .map((el: any) => ({
        id: `osm-${el.id}`,
        name: el.tags?.name ?? 'local place',
        type: el.type,
        lat: el.lat || (el.center?.lat),
        lon: el.lon || (el.center?.lon),
        tags: el.tags || {},
      }))
      .filter((place: OSMPlace) => place.lat && place.lon) // Ensure coordinates exist
  } catch (error) {
    console.error('Error fetching local places from OSM:', error)
    return []
  }
}
