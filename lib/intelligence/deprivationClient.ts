/**
 * ONS Income Deprivation — LSOA → IMD decile (England).
 * Uses ONS ArcGIS open service; skips gracefully for Scotland/Wales or missing LSOA.
 */

import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'

export type DeprivationSnapshot = {
  found: boolean
  lsoaCode?: string
  msoaCode?: string
  /** 1 = most deprived, 10 = least deprived */
  imdDecile?: number
  incomeDeprivationScore?: number
}

const IMD_FEATURE_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Index_of_Multiple_Deprivation_Deciles/FeatureServer/0/query'

async function fetchImdForLsoa(lsoaCode: string): Promise<Pick<DeprivationSnapshot, 'imdDecile' | 'incomeDeprivationScore'>> {
  const params = new URLSearchParams({
    where: `LSOA11CD='${lsoaCode.replace(/'/g, "''")}'`,
    outFields: 'IMD_DECILE,INCOME_DECILE',
    returnGeometry: 'false',
    f: 'json',
  })
  try {
    const res = await fetch(`${IMD_FEATURE_URL}?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return {}
    const json = (await res.json()) as {
      features?: Array<{ attributes?: Record<string, number> }>
    }
    const attrs = json?.features?.[0]?.attributes
    if (!attrs) return {}
    const imdDecile = Number(attrs.IMD_DECILE ?? attrs.INCOME_DECILE)
    const incomeDeprivationScore = Number(attrs.INCOME_DECILE)
    return {
      imdDecile: Number.isFinite(imdDecile) ? Math.round(imdDecile) : undefined,
      incomeDeprivationScore: Number.isFinite(incomeDeprivationScore)
        ? incomeDeprivationScore
        : undefined,
    }
  } catch {
    return {}
  }
}

export async function fetchDeprivationByPostcode(postcode: string): Promise<DeprivationSnapshot> {
  const geo = await fetchPostcodeGeo(postcode)
  const empty: DeprivationSnapshot = {
    found: false,
    lsoaCode: geo.lsoaCode,
    msoaCode: geo.msoaCode,
  }
  if (!geo.found || !geo.lsoaCode) return empty

  const imd = await fetchImdForLsoa(geo.lsoaCode)
  if (!imd.imdDecile) return { ...empty, found: false }

  return {
    found: true,
    lsoaCode: geo.lsoaCode,
    msoaCode: geo.msoaCode,
    ...imd,
  }
}

/** True when IMD decile 1–3 (most deprived quartile). */
export function isHighDeprivationArea(imdDecile?: number | null): boolean {
  return typeof imdDecile === 'number' && imdDecile >= 1 && imdDecile <= 3
}

/** True when IMD decile 8–10 (least deprived). */
export function isLowDeprivationArea(imdDecile?: number | null): boolean {
  return typeof imdDecile === 'number' && imdDecile >= 8 && imdDecile <= 10
}
