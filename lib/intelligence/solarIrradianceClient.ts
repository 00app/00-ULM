/**
 * EU PVGIS — annual solar irradiance + optimal tilt for a UK postcode (via lat/lon).
 * @see https://re.jrc.ec.europa.eu/pvg_tools/en/
 */

import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'

export type SolarIrradianceSnapshot = {
  found: boolean
  annualIrradianceKwhM2?: number
  optimalTiltAngle?: number
  optimalAzimuth?: number
  /** Same yield factor used by legacy pvgisClient. */
  yieldFactor: number
}

export async function fetchSolarIrradianceByPostcode(
  postcode: string
): Promise<SolarIrradianceSnapshot> {
  const empty: SolarIrradianceSnapshot = { found: false, yieldFactor: 1 }
  const geo = await fetchPostcodeGeo(postcode)
  if (!geo.found || geo.lat == null || geo.lon == null) return empty

  const peakPower = 1
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${geo.lat}&lon=${geo.lon}&peakpower=${peakPower}&loss=14&outputformat=json`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(14_000) })
    if (!res.ok) return empty
    const json = (await res.json()) as {
      outputs?: {
        totals?: { E_y?: number; 'H(i)_y'?: number; H_y?: number }
        incident?: { slope?: { annual?: number } }
        mounting_system?: { fixed?: { slope?: { value?: number }; azimuth?: { value?: number } } }
      }
    }
    const totals = json?.outputs?.totals
    const annualEnergy = totals?.E_y
    const hIy = totals?.['H(i)_y'] ?? totals?.H_y ?? json?.outputs?.incident?.slope?.annual
    const annualIrradianceKwhM2 =
      typeof hIy === 'number' && Number.isFinite(hIy)
        ? Math.round(hIy)
        : typeof annualEnergy === 'number' && Number.isFinite(annualEnergy)
          ? Math.round(annualEnergy / (peakPower * 0.86))
          : undefined

    const fixed = json?.outputs?.mounting_system?.fixed
    const optimalTiltAngle = fixed?.slope?.value
    const optimalAzimuth = fixed?.azimuth?.value

    if (!annualIrradianceKwhM2) return empty

    const yieldFactor = Math.min(1.35, Math.max(0.85, annualIrradianceKwhM2 / 1000))

    return {
      found: true,
      annualIrradianceKwhM2,
      optimalTiltAngle:
        typeof optimalTiltAngle === 'number' && Number.isFinite(optimalTiltAngle)
          ? Math.round(optimalTiltAngle)
          : undefined,
      optimalAzimuth:
        typeof optimalAzimuth === 'number' && Number.isFinite(optimalAzimuth)
          ? Math.round(optimalAzimuth)
          : undefined,
      yieldFactor,
    }
  } catch {
    return empty
  }
}

export function isHighSolarPotential(annualIrradianceKwhM2?: number | null): boolean {
  return typeof annualIrradianceKwhM2 === 'number' && annualIrradianceKwhM2 > 1000
}

export function isLowSolarPotential(annualIrradianceKwhM2?: number | null): boolean {
  return typeof annualIrradianceKwhM2 === 'number' && annualIrradianceKwhM2 < 900
}
