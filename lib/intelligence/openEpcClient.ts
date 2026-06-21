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
  propertyType?: string
  mainFuel?: string
  wallsDescription?: string
  roofDescription?: string
  /** Multiplier for heating-loss heuristics (higher = worse envelope). */
  currentThermalEfficiencyMultiplier: number
  description: string
  lodgementDate?: string
  address?: string
  /** Set when caller passed `houseNumber` and a register row matched that token. */
  addressMatched?: boolean
}

const EPC_BASE = 'https://epc.opendatacommunities.org/api/v1/domestic/search'

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

function rowToOpenEpcProfile(
  row: Record<string, unknown>,
  compact: string,
  addressMatched?: boolean
): OpenEpcProfile {
  const current =
    String(row['current-energy-rating'] ?? row.current_energy_rating ?? '').trim() || undefined
  const potential =
    String(row['potential-energy-rating'] ?? row.potential_energy_rating ?? '').trim() ||
    undefined
  const propertyType =
    String(row['property-type'] ?? row.property_type ?? '').trim() || undefined
  const mainFuel = String(row['main-fuel'] ?? row.main_fuel ?? '').trim() || undefined
  const walls = String(row['walls-description'] ?? row.walls_description ?? '').trim()
  const roof = String(row['roof-description'] ?? row.roof_description ?? '').trim()
  const address = String(row.address ?? row['address1'] ?? '').trim() || undefined
  const lodgement = String(row['lodgement-date'] ?? row.lodgement_date ?? '').trim() || undefined

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
    propertyType,
    mainFuel,
    wallsDescription: walls || undefined,
    roofDescription: roof || undefined,
    currentThermalEfficiencyMultiplier: ratingToThermalMultiplier(current),
    description: parts.join('; ') || 'epc register match',
    lodgementDate: lodgement,
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
