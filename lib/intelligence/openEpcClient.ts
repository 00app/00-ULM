/**
 * Open Data Communities — Domestic EPC search (England & Wales).
 * Requires OPENEPC_EMAIL + OPENEPC_API_KEY (HTTP Basic). Skips gracefully when unset.
 * @see https://epc.opendatacommunities.org/docs/api/domestic
 */

import {
  filterEpcRowsByHouseNumber,
  normalizeHouseNumberToken,
} from '@/lib/intelligence/epcAddressMatch'

export type FetchOpendataEpcOptions = {
  houseNumber?: string | null
}

export type OpenEpcProfile = {
  found: boolean
  postcode: string
  /** e.g. "D" */
  currentEnergyRating?: string
  /** e.g. "C" */
  potentialEnergyRating?: string
  currentEnergyEfficiencyScore?: number
  potentialEnergyEfficiencyScore?: number
  propertyType?: string
  mainFuel?: string
  mainsGasFlag?: 'Y' | 'N'
  wallsDescription?: string
  roofDescription?: string
  floorDescription?: string
  windowsDescription?: string
  heatingCostCurrent?: number
  heatingCostPotential?: number
  lightingCostCurrent?: number
  lightingCostPotential?: number
  hotWaterCostCurrent?: number
  totalFloorArea?: number
  builtForm?: string
  constructionAgeBand?: string
  numberHabRooms?: number
  tenure?: string
  /** Multiplier for heating-loss heuristics (higher = worse envelope). */
  currentThermalEfficiencyMultiplier: number
  description: string
  lodgementDate?: string
  /** True when lodgement is more than 10 years ago — EPC may be stale. */
  isStale?: boolean
  address?: string
  /** Set when caller passed `houseNumber` and a register row matched that token. */
  addressMatched?: boolean
}

const EPC_BASE = 'https://epc.opendatacommunities.org/api/v1/domestic/search'

const EPC_STALE_YEARS = 10

function ratingToThermalMultiplier(rating: string | undefined): number {
  const r = (rating ?? '').trim().toUpperCase()
  const map: Record<string, number> = {
    A: 0.75,
    B: 0.85,
    C: 0.9,
    D: 1.0,
    E: 1.15,
    F: 1.25,
    G: 1.35,
  }
  return map[r] ?? 1.1
}

function epcCredentials(): { email: string; apiKey: string } | null {
  const email = process.env.OPENEPC_EMAIL?.trim() ?? process.env.EPC_API_EMAIL?.trim()
  const apiKey = process.env.OPENEPC_API_KEY?.trim() ?? process.env.EPC_API_KEY?.trim()
  if (!email || !apiKey) return null
  return { email, apiKey }
}

function pickLatestRow(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => {
    const da = String(a['lodgement-date'] ?? a.lodgement_date ?? '')
    const db = String(b['lodgement-date'] ?? b.lodgement_date ?? '')
    return db.localeCompare(da)
  })
  return sorted[0] ?? null
}

function rowString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = row[key]
    if (raw == null || raw === '') continue
    const s = String(raw).trim()
    if (s) return s
  }
  return undefined
}

function rowNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = row[key]
    if (raw == null || raw === '') continue
    const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function rowMainsGasFlag(row: Record<string, unknown>): 'Y' | 'N' | undefined {
  const raw = rowString(row, 'mains-gas-flag', 'mains_gas_flag')
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (upper === 'Y' || upper === 'YES' || upper === '1') return 'Y'
  if (upper === 'N' || upper === 'NO' || upper === '0') return 'N'
  return undefined
}

/** True when lodgement date is more than {@link EPC_STALE_YEARS} years ago. */
export function isEpcStale(lodgementDate: string | undefined): boolean {
  if (!lodgementDate?.trim()) return false
  const filed = new Date(lodgementDate.trim())
  if (Number.isNaN(filed.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - EPC_STALE_YEARS)
  return filed < cutoff
}

function rowToOpenEpcProfile(
  row: Record<string, unknown>,
  compact: string,
  addressMatched?: boolean
): OpenEpcProfile {
  const current = rowString(row, 'current-energy-rating', 'current_energy_rating')
  const potential = rowString(row, 'potential-energy-rating', 'potential_energy_rating')
  const propertyType = rowString(row, 'property-type', 'property_type')
  const mainFuel = rowString(row, 'main-fuel', 'main_fuel')
  const walls = rowString(row, 'walls-description', 'walls_description')
  const roof = rowString(row, 'roof-description', 'roof_description')
  const floor = rowString(row, 'floor-description', 'floor_description')
  const windows = rowString(row, 'windows-description', 'windows_description')
  const address = rowString(row, 'address', 'address1')
  const lodgement = rowString(row, 'lodgement-date', 'lodgement_date')
  const builtForm = rowString(row, 'built-form', 'built_form')
  const constructionAgeBand = rowString(row, 'construction-age-band', 'construction_age_band')
  const tenure = rowString(row, 'tenure')

  const parts = [
    propertyType ? `type ${propertyType}` : '',
    current ? `band ${current}` : '',
    mainFuel ? `fuel ${mainFuel}` : '',
    walls ? `walls ${walls.slice(0, 80)}` : '',
    roof ? `roof ${roof.slice(0, 60)}` : '',
  ].filter(Boolean)

  return {
    found: true,
    postcode: compact,
    currentEnergyRating: current,
    potentialEnergyRating: potential,
    currentEnergyEfficiencyScore: rowNumber(
      row,
      'current-energy-efficiency',
      'current_energy_efficiency'
    ),
    potentialEnergyEfficiencyScore: rowNumber(
      row,
      'potential-energy-efficiency',
      'potential_energy_efficiency'
    ),
    propertyType,
    mainFuel,
    mainsGasFlag: rowMainsGasFlag(row),
    wallsDescription: walls,
    roofDescription: roof,
    floorDescription: floor,
    windowsDescription: windows,
    heatingCostCurrent: rowNumber(row, 'heating-cost-current', 'heating_cost_current'),
    heatingCostPotential: rowNumber(row, 'heating-cost-potential', 'heating_cost_potential'),
    lightingCostCurrent: rowNumber(row, 'lighting-cost-current', 'lighting_cost_current'),
    lightingCostPotential: rowNumber(row, 'lighting-cost-potential', 'lighting_cost_potential'),
    hotWaterCostCurrent: rowNumber(row, 'hot-water-cost-current', 'hot_water_cost_current'),
    totalFloorArea: rowNumber(row, 'total-floor-area', 'total_floor_area'),
    builtForm,
    constructionAgeBand,
    numberHabRooms: rowNumber(row, 'number-habitable-rooms', 'number_habitable_rooms'),
    tenure,
    currentThermalEfficiencyMultiplier: ratingToThermalMultiplier(current),
    description: parts.join('; ') || 'epc register match',
    lodgementDate: lodgement,
    isStale: isEpcStale(lodgement),
    address,
    addressMatched,
  }
}

export async function fetchOpendataEpcProfile(
  postcode: string,
  options?: FetchOpendataEpcOptions
): Promise<OpenEpcProfile> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  const houseToken = normalizeHouseNumberToken(options?.houseNumber)
  const empty: OpenEpcProfile = {
    found: false,
    postcode: compact,
    currentThermalEfficiencyMultiplier: 1.1,
    description: houseToken
      ? 'no epc register match for this house number at postcode'
      : 'no epc register match for postcode',
    addressMatched: houseToken ? false : undefined,
  }
  if (compact.length < 4) return empty

  const creds = epcCredentials()
  if (!creds) return empty

  const auth = Buffer.from(`${creds.email}:${creds.apiKey}`).toString('base64')
  const size = houseToken ? 25 : 5
  const url = `${EPC_BASE}?postcode=${encodeURIComponent(compact)}&size=${size}`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    })
    if (!res.ok) return empty
    const json = (await res.json()) as { rows?: Record<string, unknown>[] }
    const allRows = Array.isArray(json?.rows) ? json.rows : []
    const rows = houseToken ? filterEpcRowsByHouseNumber(allRows, houseToken) : allRows
    if (houseToken && rows.length === 0) return empty
    const row = pickLatestRow(rows)
    if (!row) return empty

    return rowToOpenEpcProfile(row, compact, houseToken ? true : undefined)
  } catch {
    return empty
  }
}
