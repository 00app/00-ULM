/**
 * National Grid ESO — Carbon Intensity API (half-hourly national/regional intensity).
 * @see https://carbon-intensity.github.io/api-definitions/#carbon-intensity-api-v2-0-0
 */

export async function getNationalGridIntensityGPerKwh(): Promise<number | null> {
  try {
    const res = await fetch('https://api.carbonintensity.org.uk/intensity', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: Array<{ intensity?: { actual?: number; forecast?: number } }>
    }
    const row = json?.data?.[0]?.intensity
    const v = row?.actual ?? row?.forecast
    return typeof v === 'number' && !Number.isNaN(v) ? v : null
  } catch {
    return null
  }
}

/** 2025-style UK grid rough average (g/kWh) for “% cleaner than last year” copy. */
export const GRID_BASELINE_2025_G_PER_KWH = 180

export function gridCleanerPercentVs2025(intensityGPerKwh: number | null): number | null {
  if (intensityGPerKwh == null || GRID_BASELINE_2025_G_PER_KWH <= 0) return null
  const raw = (1 - intensityGPerKwh / GRID_BASELINE_2025_G_PER_KWH) * 100
  return Math.round(Math.max(0, Math.min(99, raw)))
}
