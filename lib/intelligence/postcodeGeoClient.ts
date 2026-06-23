/**
 * Postcodes.io — LSOA / MSOA / geocode anchor for property intelligence.
 */

export type PostcodeGeoSnapshot = {
  found: boolean
  postcode: string
  lsoaCode?: string
  msoaCode?: string
  lat?: number
  lon?: number
  parliamentaryConstituency?: string
  adminDistrict?: string
}

export async function fetchPostcodeGeo(postcode: string): Promise<PostcodeGeoSnapshot> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  const empty: PostcodeGeoSnapshot = { found: false, postcode: compact }
  if (compact.length < 4) return empty

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (!res.ok) return empty
    const json = (await res.json()) as {
      result?: {
        latitude?: number
        longitude?: number
        lsoa?: string
        msoa?: string
        codes?: { lsoa?: string; msoa?: string; admin_district?: string }
        parliamentary_constituency?: string
        admin_district?: string
      }
    }
    const r = json?.result
    if (!r) return empty
    return {
      found: true,
      postcode: compact,
      lsoaCode: r.codes?.lsoa ?? r.lsoa,
      msoaCode: r.codes?.msoa ?? r.msoa,
      lat: typeof r.latitude === 'number' ? r.latitude : undefined,
      lon: typeof r.longitude === 'number' ? r.longitude : undefined,
      parliamentaryConstituency: r.parliamentary_constituency,
      adminDistrict: r.admin_district ?? r.codes?.admin_district,
    }
  } catch {
    return empty
  }
}
