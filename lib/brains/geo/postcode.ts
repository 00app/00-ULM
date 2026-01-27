/**
 * Postcode to location conversion using OpenStreetMap Nominatim API
 */

export interface Coordinates {
  lat: number
  lon: number
}

/**
 * Convert UK postcode to latitude/longitude using OpenStreetMap Nominatim
 * Free, no API key required
 */
export async function postcodeToLatLon(postcode: string): Promise<Coordinates | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}&countrycodes=gb&limit=1`,
      {
        headers: {
          'User-Agent': 'Zero Zero App',
        },
      }
    )
    const data = await res.json()

    if (!data?.length) return null

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    }
  } catch (error) {
    console.error('Error geocoding postcode:', error)
    return null
  }
}
