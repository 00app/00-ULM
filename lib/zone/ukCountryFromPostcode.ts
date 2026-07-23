/**
 * Coarse UK-country classifier from postcode outward-code area letters — good enough to route
 * a user to the right national scheme (Home Energy Scotland vs NI Direct vs GOV.UK), not precise
 * geocoding. A handful of areas straddle borders (e.g. DG, TD lean Scottish but touch England);
 * this picks the predominant country for that area, same tolerance a comparison site would use.
 */

export type UkCountry = 'scotland' | 'northern-ireland' | 'england-wales'

const SCOTLAND_AREAS = new Set([
  'AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE',
])

const NORTHERN_IRELAND_AREAS = new Set(['BT'])

export function ukCountryFromPostcode(postcode: string | null | undefined): UkCountry {
  const compact = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  const match = compact.match(/^[A-Z]+/)
  const letters = match?.[0] ?? ''
  if (!letters) return 'england-wales'

  // Try the 2-letter area first (e.g. "EH" of "EH1 1AA"), then fall back to 1-letter areas
  // (e.g. "G" of "G1 1AA") — longest-prefix match avoids "G" wrongly matching inside "GL" (Gloucester).
  const twoLetter = letters.slice(0, 2)
  const oneLetter = letters.slice(0, 1)

  if (SCOTLAND_AREAS.has(twoLetter)) return 'scotland'
  if (NORTHERN_IRELAND_AREAS.has(twoLetter)) return 'northern-ireland'
  if (twoLetter.length < 2 && SCOTLAND_AREAS.has(oneLetter)) return 'scotland'

  return 'england-wales'
}
