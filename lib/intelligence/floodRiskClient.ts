/**
 * Environment Agency — flood area proximity by postcode geocode.
 * @see https://environment.data.gov.uk/flood-monitoring/doc/reference
 */

import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'

export type FloodRiskZone = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

export type FloodRiskSnapshot = {
  found: boolean
  floodRiskZone: FloodRiskZone
  nearestAreaCount?: number
}

function severityToZone(severity: string | undefined, count: number): FloodRiskZone {
  const s = (severity ?? '').trim().toLowerCase()
  if (s.includes('severe') || count >= 5) return 'VERY_HIGH'
  if (s.includes('warning') || count >= 3) return 'HIGH'
  if (s.includes('alert') || count >= 1) return 'MEDIUM'
  return 'LOW'
}

export async function fetchFloodRiskByPostcode(postcode: string): Promise<FloodRiskSnapshot> {
  const geo = await fetchPostcodeGeo(postcode)
  const fallback: FloodRiskSnapshot = { found: false, floodRiskZone: 'LOW' }
  if (!geo.found || geo.lat == null || geo.lon == null) return fallback

  try {
    const url = `https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${geo.lat}&long=${geo.lon}&dist=15`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return fallback
    const json = (await res.json()) as {
      items?: Array<{ severityLevel?: string; severity?: string }>
    }
    const items = Array.isArray(json?.items) ? json.items : []
    if (items.length === 0) {
      return { found: true, floodRiskZone: 'LOW', nearestAreaCount: 0 }
    }
    const topSeverity = items[0]?.severityLevel ?? items[0]?.severity
    return {
      found: true,
      floodRiskZone: severityToZone(topSeverity, items.length),
      nearestAreaCount: items.length,
    }
  } catch {
    return fallback
  }
}

export function isHighFloodRisk(zone?: FloodRiskZone | null): boolean {
  return zone === 'HIGH' || zone === 'VERY_HIGH'
}
