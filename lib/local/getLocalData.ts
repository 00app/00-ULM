/**
 * Local Living — Postcodes.io + Carbon Intensity API (free, no auth).
 * Translates postcode into council, region, ward and regional gCO₂/kWh
 * for ZeroResearch / Zai and the Zone dashboard.
 */

/** April 2026 auditor lock — BUS vs Scottish HES; every field includes citation. */
export interface HeatPumpGrantAuditorContext {
  primary_scheme_label: string
  primary_max_gbp: number
  comparison_note: string
  source_url: string
  verified_date: string
}

export interface LocalIntelligence {
  /** e.g. "Westminster", "Manchester", "Sevenoaks" */
  council: string
  /** e.g. "London", "North West" */
  region: string
  /** Regional grid intensity (gCO₂/kWh). Undefined if API unavailable. */
  localCarbonG?: number
  /** e.g. "St James's" */
  ward?: string
  /** Outcode used for carbon API (e.g. "SW1A") */
  outcode?: string
  /** Parish / settlement label when Postcodes.io returns it — best for “In {locality}”. */
  locality?: string
  /** e.g. "England", "Scotland", "Wales" — from Postcodes.io `country` / nuts heuristics */
  country?: string
  /** Sentinel v5.9 — real grant ceilings for scraper / zone copy (not UI). */
  heat_pump_grant_context?: HeatPumpGrantAuditorContext
}

function titleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const HES_HEAT_PUMP_URL =
  'https://www.homeenergyscotland.org/funding-grants/heat-pump-grants-loans/'
const GOV_UK_BUS_URL = 'https://www.gov.uk/apply-boiler-upgrade-scheme'

function attachHeatPumpGrantContext(cleanPostcode: string, data: LocalIntelligence): LocalIntelligence {
  const kw = /^KW/i.test(cleanPostcode.replace(/\s+/g, '').toUpperCase())
  if (kw) {
    return {
      ...data,
      heat_pump_grant_context: {
        primary_scheme_label: 'Home Energy Scotland — north Scotland rural pathways',
        primary_max_gbp: 9000,
        comparison_note:
          'England & Wales official heat pump support is typically up to £7,500 where rules allow; eligible north Scotland installs may access higher support via HES.',
        source_url: HES_HEAT_PUMP_URL,
        verified_date: 'April 2026',
      },
    }
  }
  return {
    ...data,
    heat_pump_grant_context: {
      primary_scheme_label: 'England & Wales heat pump support (official cap pathway)',
      primary_max_gbp: 7500,
      comparison_note:
        'North Scotland outward codes may access Home Energy Scotland with different ceilings (up to £9,000 with rural uplift where eligible).',
      source_url: GOV_UK_BUS_URL,
      verified_date: 'April 2026',
    },
  }
}

async function getLocalDataFromOpenStreetMap(cleanPostcode: string): Promise<LocalIntelligence | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gb&limit=1&addressdetails=1&postalcode=${encodeURIComponent(cleanPostcode)}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'zero-zero-local-intelligence/1.0',
          Accept: 'application/json',
        },
      }
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{
      address?: Record<string, string>
      display_name?: string
    }>
    const row = rows?.[0]
    if (!row) return null

    const address = row.address ?? {}
    const councilRaw =
      address.city_district ||
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state_district ||
      address.state ||
      ''
    const regionRaw = address.state || address.state_district || address.county || councilRaw
    const countryRaw = address.country || 'United Kingdom'
    const localityRaw = address.suburb || address.neighbourhood || address.village || address.town || address.city || ''

    const outcode = cleanPostcode.slice(0, Math.max(2, Math.min(4, cleanPostcode.length)))
    return {
      council: titleCaseWords(councilRaw || 'Unknown'),
      region: titleCaseWords(regionRaw || councilRaw || 'United Kingdom'),
      ward: address.suburb ? titleCaseWords(address.suburb) : undefined,
      outcode,
      locality: localityRaw ? titleCaseWords(localityRaw) : undefined,
      country: countryRaw,
    }
  } catch {
    return null
  }
}

function getRegionFromOutcode(outcode: string): string {
  const o = outcode.toUpperCase()
  if (/^(EC|WC|N|NW|SE|SW|E)/.test(o)) return 'London'
  if (/^(BN|PO|SO|GU|RH|KT|RG|OX)/.test(o)) return 'South East'
  if (/^(BS|BA|EX|PL|TR|TA|TQ|GL|SN)/.test(o)) return 'South West'
  if (/^(B|CV|DE|DY|LE|NG|NN|ST|WS|WV)/.test(o)) return 'Midlands'
  if (/^(M|L|OL|SK|WA|WN|FY|PR|BB|BL)/.test(o)) return 'North West'
  if (/^(NE|DH|SR|DL|TS|YO|HU|DN|S|LS|HD|HX|WF)/.test(o)) return 'North East'
  if (/^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)/.test(o)) return 'Scotland'
  if (/^(CF|LD|LL|NP|SA|SY)/.test(o)) return 'Wales'
  return 'United Kingdom'
}

function getEmergencyPostcodeFallback(cleanPostcode: string): LocalIntelligence {
  const outcode = cleanPostcode.slice(0, Math.max(2, Math.min(4, cleanPostcode.length)))
  const region = getRegionFromOutcode(outcode)
  const inferredLocality = region === 'London' ? 'London' : outcode
  const inferredCouncil = `${region} Council`
  return attachHeatPumpGrantContext(cleanPostcode, {
    council: inferredCouncil,
    region,
    locality: inferredLocality,
    outcode,
    country: region === 'Scotland' ? 'Scotland' : region === 'Wales' ? 'Wales' : 'England',
  })
}

export async function getLocalData(postcode: string): Promise<LocalIntelligence | null> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase().trim()
  if (!clean || clean.length < 4) return null

  try {
    // 1. Postcodes.io — admin_district, region, admin_ward
    const pcRes = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!pcRes.ok) {
      const osmEarly = await getLocalDataFromOpenStreetMap(clean)
      if (osmEarly) return attachHeatPumpGrantContext(clean, osmEarly)
      return getEmergencyPostcodeFallback(clean)
    }
    const pcJson = await pcRes.json()
    const result = pcJson?.result
    if (!result) {
      const osmMid = await getLocalDataFromOpenStreetMap(clean)
      if (osmMid) return attachHeatPumpGrantContext(clean, osmMid)
      return getEmergencyPostcodeFallback(clean)
    }

    const council = result.admin_district ?? result.region ?? 'Unknown'
    const region = result.region ?? council
    const ward = result.admin_ward
    const outcode = (result.outcode ?? clean.slice(0, 4)) as string
    const parish =
      typeof result.parish === 'string' && result.parish.trim() ? result.parish.trim() : ''
    const wardFirst =
      typeof ward === 'string' && ward.trim() ? String(ward).split(',')[0]?.trim() ?? '' : ''
    const locality = parish || wardFirst || undefined
    const countryRaw = typeof result.country === 'string' ? result.country.trim() : ''
    const nuts = typeof result.codes?.nuts === 'string' ? result.codes.nuts.trim() : ''
    const country =
      ['England', 'Scotland', 'Wales', 'Northern Ireland'].includes(countryRaw)
        ? countryRaw
        : nuts.startsWith('UKS')
          ? 'Scotland'
          : nuts.startsWith('UKW')
            ? 'Wales'
            : nuts.startsWith('UKE')
              ? 'England'
              : /scotland/i.test(region)
                ? 'Scotland'
                : countryRaw || undefined

    let localCarbonG: number | undefined
    try {
      // 2. Carbon Intensity API — regional gCO₂/kWh (uses outcode)
      const carbonRes = await fetch(
        `https://api.carbonintensity.org.uk/regional/postcode/${encodeURIComponent(outcode)}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (carbonRes.ok) {
        const carbonJson = await carbonRes.json()
        const d = carbonJson?.data?.[0]
        const region = d?.regions?.[0] ?? d
        localCarbonG = region?.intensity?.actual ?? region?.intensity?.forecast
      }
    } catch {
      // Non-fatal: dashboard still shows council/region
    }

    return attachHeatPumpGrantContext(clean, { council, region, localCarbonG, ward, outcode, locality, country })
  } catch {
    const osmCatch = await getLocalDataFromOpenStreetMap(clean)
    if (osmCatch) return attachHeatPumpGrantContext(clean, osmCatch)
    return getEmergencyPostcodeFallback(clean)
  }
}
