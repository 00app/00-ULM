/**
 * Local Living — Postcodes.io + Carbon Intensity API (free, no auth).
 * Translates postcode into council, region, ward and regional gCO₂/kWh
 * for OpenClaw agents and the Zone dashboard.
 */

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
    if (!pcRes.ok) return null
    const pcJson = await pcRes.json()
    const result = pcJson?.result
    if (!result) return null

    const council = result.admin_district ?? result.region ?? 'Unknown'
    const region = result.region ?? council
    const ward = result.admin_ward
    const outcode = (result.outcode ?? clean.slice(0, 4)) as string

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

    return { council, region, localCarbonG, ward, outcode }
  } catch {
    return null
  }
}
