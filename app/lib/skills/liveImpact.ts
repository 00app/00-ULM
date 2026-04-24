import { z } from 'zod'

/** Ofgem Q2 2026 (Direct Debit) lock — pence / kWh. */
export const OFGEM_Q2_2026_ELECTRIC_PENCE_PER_KWH = 24.67
export const OFGEM_Q2_2026_GAS_PENCE_PER_KWH = 5.74

const GRID_INTENSITY_API_URL = 'https://api.carbonintensity.org.uk/intensity'
const GRID_REGIONAL_API_URL = 'https://api.carbonintensity.org.uk/regional'

/**
 * "Home Idle" baseline assumptions for a 24h day.
 * Kept explicit so Sentinel math is auditable.
 */
const HOME_IDLE_KWH_PER_DAY = {
  electricity: 8.4,
  gas: 4.2,
} as const

/** Approximate UK gas carbon factor (kg CO2e / kWh). */
const GAS_CARBON_KG_PER_KWH = 0.183

const REGION_ALIASES: Record<string, string[]> = {
  london: ['london'],
  'north west': ['north west', 'north-west', 'northwest'],
  'north east': ['north east', 'north-east', 'northeast'],
  yorkshire: ['yorkshire', 'yorkshire and humber', 'humber'],
  midlands: ['midlands', 'east midlands', 'west midlands'],
  'south east': ['south east', 'south-east', 'southeast'],
  'south west': ['south west', 'south-west', 'southwest'],
  scotland: ['scotland'],
  wales: ['wales'],
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeRegion(region: string | undefined): string | null {
  if (!region) return null
  const needle = region.trim().toLowerCase()
  if (!needle) return null
  for (const [canonical, aliases] of Object.entries(REGION_ALIASES)) {
    if (aliases.some((a) => needle.includes(a))) return canonical
  }
  return needle
}

function pulseColorForIntensity(gPerKwh: number): string {
  if (gPerKwh > 80) return '#ffd60a'
  if (gPerKwh <= 80) return '#32d74b'
  if (gPerKwh <= 260) return '#ff9f0a'
  return '#ff453a'
}

async function fetchNationalGridIntensity(): Promise<number | null> {
  try {
    const res = await fetch(GRID_INTENSITY_API_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: Array<{ intensity?: { forecast?: unknown; actual?: unknown } }> }
    const row = data?.data?.[0]
    const forecast = toNumber(row?.intensity?.forecast)
    if (forecast != null) return forecast
    return toNumber(row?.intensity?.actual)
  } catch {
    return null
  }
}

async function fetchRegionalGridIntensity(region: string | undefined): Promise<{ intensityGPerKwh: number | null; matchedRegion: string | null }> {
  const normalized = normalizeRegion(region)
  try {
    const res = await fetch(GRID_REGIONAL_API_URL, { cache: 'no-store' })
    if (!res.ok) return { intensityGPerKwh: await fetchNationalGridIntensity(), matchedRegion: null }
    const payload = (await res.json()) as {
      data?: Array<{
        regions?: Array<{
          shortname?: string
          dnoregion?: string
          intensity?: { forecast?: unknown; actual?: unknown }
        }>
      }>
    }
    const regions = payload?.data?.[0]?.regions ?? []
    if (!regions.length) return { intensityGPerKwh: await fetchNationalGridIntensity(), matchedRegion: null }

    const matched = normalized
      ? regions.find((r) => {
          const short = (r.shortname ?? '').toLowerCase()
          const dno = String(r.dnoregion ?? '').toLowerCase()
          return short.includes(normalized) || dno.includes(normalized)
        })
      : null

    const target = matched ?? regions[0]
    const forecast = toNumber(target?.intensity?.forecast)
    const actual = toNumber(target?.intensity?.actual)
    return {
      intensityGPerKwh: forecast ?? actual ?? (await fetchNationalGridIntensity()),
      matchedRegion: target?.shortname ?? null,
    }
  } catch {
    return { intensityGPerKwh: await fetchNationalGridIntensity(), matchedRegion: null }
  }
}

export const liveImpactInputSchema = z.object({
  region: z.string().optional(),
})

export type LiveImpactInput = z.infer<typeof liveImpactInputSchema>

export type LiveImpactBaseline = {
  region: string | null
  source: 'carbonintensity.org.uk'
  rates: {
    electricityPencePerKwh: number
    gasPencePerKwh: number
  }
  homeIdle24h: {
    electricityKwh: number
    gasKwh: number
    totalCostGbp: number
    totalCarbonKg: number
    costPerCarbonKgGbp: number
  }
  grid: {
    intensityGPerKwh: number
    pulseColor: string
  }
}

/**
 * Live-Impact Skill v1.0
 * Returns precise baseline £/kg for a 24h "Home Idle" profile state.
 */
export async function getLiveBaseline(input: LiveImpactInput = {}): Promise<LiveImpactBaseline> {
  const { intensityGPerKwh, matchedRegion } = await fetchRegionalGridIntensity(input.region)
  const intensity = intensityGPerKwh ?? 170

  const electricCostGbp =
    (HOME_IDLE_KWH_PER_DAY.electricity * OFGEM_Q2_2026_ELECTRIC_PENCE_PER_KWH) / 100
  const gasCostGbp = (HOME_IDLE_KWH_PER_DAY.gas * OFGEM_Q2_2026_GAS_PENCE_PER_KWH) / 100
  const totalCostGbp = electricCostGbp + gasCostGbp

  const electricCarbonKg = (HOME_IDLE_KWH_PER_DAY.electricity * intensity) / 1000
  const gasCarbonKg = HOME_IDLE_KWH_PER_DAY.gas * GAS_CARBON_KG_PER_KWH
  const totalCarbonKg = electricCarbonKg + gasCarbonKg

  return {
    region: matchedRegion ?? normalizeRegion(input.region),
    source: 'carbonintensity.org.uk',
    rates: {
      electricityPencePerKwh: OFGEM_Q2_2026_ELECTRIC_PENCE_PER_KWH,
      gasPencePerKwh: OFGEM_Q2_2026_GAS_PENCE_PER_KWH,
    },
    homeIdle24h: {
      electricityKwh: HOME_IDLE_KWH_PER_DAY.electricity,
      gasKwh: HOME_IDLE_KWH_PER_DAY.gas,
      totalCostGbp: Number(totalCostGbp.toFixed(3)),
      totalCarbonKg: Number(totalCarbonKg.toFixed(3)),
      costPerCarbonKgGbp: Number((totalCostGbp / Math.max(totalCarbonKg, 0.001)).toFixed(3)),
    },
    grid: {
      intensityGPerKwh: Number(intensity.toFixed(1)),
      pulseColor: pulseColorForIntensity(intensity),
    },
  }
}
