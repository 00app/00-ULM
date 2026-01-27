/**
 * Fetch local offers from OpenStreetMap using Overpass API
 * Free, no API key required
 */
export interface LocalOffer {
  id: string
  title: string
  category: string
  lat: number
  lon: number
  tags: Record<string, string>
}

export async function fetchLocalOffers(
  lat: number,
  lon: number,
  radius = 3000
): Promise<LocalOffer[]> {
  try {
    const query = `
[out:json][timeout:25];
(
  node["shop"~"organic|zero_waste|second_hand|repair|bicycle|clothes"](around:${radius},${lat},${lon});
  node["amenity"~"bicycle_repair_station|library|community_centre"](around:${radius},${lat},${lon});
  node["craft"~"repair|recycling"](around:${radius},${lat},${lon});
);
out body;
`

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
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
      .slice(0, 6) // Limit to 6
      .map((el: any) => ({
        id: `osm-${el.id}`,
        title: el.tags?.name ?? 'local option',
        category: el.tags?.shop || el.tags?.amenity || el.tags?.craft || 'local',
        lat: el.lat,
        lon: el.lon,
        tags: el.tags || {},
      }))
  } catch (error) {
    console.error('Error fetching local offers:', error)
    return []
  }
}
