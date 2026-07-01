/**
 * Climatiq — activity-based carbon emission calculations.
 * Free tier: 10,000 estimates/month. Requires CLIMATIQ_API_KEY (free signup).
 * @see https://www.climatiq.io/docs
 *
 * Covers: electricity, gas heating, car travel, rail travel, air travel.
 * Uses UK-specific emission factors (region "GB", DESNZ/BEIS source).
 * Skips gracefully when API key unset.
 */

const CLIMATIQ_BASE = 'https://api.climatiq.io'
const TIMEOUT_MS = 8_000

function climatiqKey(): string | null {
  return process.env.CLIMATIQ_API_KEY?.trim() ?? null
}

async function climatiqPost<T>(path: string, body: unknown, key: string): Promise<T | null> {
  try {
    const res = await fetch(`${CLIMATIQ_BASE}${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export type ClimatiqEmission = {
  /** kg CO₂e */
  kgCo2e: number
  source: string
}

type ClimatiqEstimateResponse = {
  co2e: number
  co2e_unit: string
  emission_factor?: { source?: string; region?: string; year?: number }
}

/** kWh electricity consumed at UK grid average → kg CO₂e */
export async function estimateElectricityEmissions(kwh: number): Promise<ClimatiqEmission | null> {
  const key = climatiqKey()
  if (!key || !Number.isFinite(kwh) || kwh <= 0) return null
  const res = await climatiqPost<ClimatiqEstimateResponse>(
    '/data/v1/estimate',
    {
      emission_factor: {
        activity_id: 'electricity-supply_grid-source_total_supplier_mix',
        region: 'GB',
      },
      parameters: { energy: kwh, energy_unit: 'kWh' },
    },
    key
  )
  if (!res) return null
  const kg = res.co2e_unit === 'kg' ? res.co2e : res.co2e / 1000
  return { kgCo2e: Math.round(kg * 100) / 100, source: 'climatiq/GB-electricity' }
}

/** m³ natural gas consumed → kg CO₂e */
export async function estimateGasEmissions(cubicMetres: number): Promise<ClimatiqEmission | null> {
  const key = climatiqKey()
  if (!key || !Number.isFinite(cubicMetres) || cubicMetres <= 0) return null
  const res = await climatiqPost<ClimatiqEstimateResponse>(
    '/energy/v1.3/fuel',
    { fuel_type: 'natural_gas', amount: { volume: cubicMetres, volume_unit: 'm3' }, region: 'GB' },
    key
  )
  if (!res) return null
  const kg = res.co2e_unit === 'kg' ? res.co2e : res.co2e / 1000
  return { kgCo2e: Math.round(kg * 100) / 100, source: 'climatiq/GB-gas' }
}

type ClimatiqTravelResponse = {
  co2e: number
  co2e_unit: string
  distance_km?: number
}

/** Car journey between two UK cities → kg CO₂e */
export async function estimateCarJourneyEmissions(params: {
  origin: string
  destination: string
  carType?: 'petrol' | 'diesel' | 'electric' | 'plugin_hybrid' | 'average'
}): Promise<(ClimatiqEmission & { distanceKm?: number }) | null> {
  const key = climatiqKey()
  if (!key) return null
  const res = await climatiqPost<ClimatiqTravelResponse>(
    '/travel/v1-preview3/distance',
    {
      travel_mode: 'car',
      origin: { query: params.origin },
      destination: { query: params.destination },
      car_details: { car_type: params.carType ?? 'average' },
    },
    key
  )
  if (!res) return null
  const kg = res.co2e_unit === 'kg' ? res.co2e : res.co2e / 1000
  return {
    kgCo2e: Math.round(kg * 100) / 100,
    distanceKm: res.distance_km,
    source: 'climatiq/car-travel',
  }
}

/** Rail journey between two UK cities → kg CO₂e */
export async function estimateRailJourneyEmissions(params: {
  origin: string
  destination: string
}): Promise<(ClimatiqEmission & { distanceKm?: number }) | null> {
  const key = climatiqKey()
  if (!key) return null
  const res = await climatiqPost<ClimatiqTravelResponse>(
    '/travel/v1-preview3/distance',
    {
      travel_mode: 'rail',
      origin: { query: params.origin },
      destination: { query: params.destination },
    },
    key
  )
  if (!res) return null
  const kg = res.co2e_unit === 'kg' ? res.co2e : res.co2e / 1000
  return {
    kgCo2e: Math.round(kg * 100) / 100,
    distanceKm: res.distance_km,
    source: 'climatiq/rail-travel',
  }
}

/** Flight between two airports → kg CO₂e */
export async function estimateFlightEmissions(params: {
  originIata: string
  destinationIata: string
  cabin?: 'economy' | 'business' | 'first'
}): Promise<(ClimatiqEmission & { distanceKm?: number }) | null> {
  const key = climatiqKey()
  if (!key) return null
  const res = await climatiqPost<ClimatiqTravelResponse>(
    '/travel/v1-preview3/distance',
    {
      travel_mode: 'air',
      origin: { iata_code: params.originIata },
      destination: { iata_code: params.destinationIata },
      air_details: { cabin_class: params.cabin ?? 'economy' },
    },
    key
  )
  if (!res) return null
  const kg = res.co2e_unit === 'kg' ? res.co2e : res.co2e / 1000
  return {
    kgCo2e: Math.round(kg * 100) / 100,
    distanceKm: res.distance_km,
    source: 'climatiq/flight',
  }
}

export function isClimatiqAvailable(): boolean {
  return !!climatiqKey()
}
