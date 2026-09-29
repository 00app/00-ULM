/**
 * UK postcode outcode -> GSP Group ID (the single-letter electricity distribution region code
 * used by Octopus Energy's own tariff URLs, e.g. E-1R-AGILE-18-02-21-C for London). This is the
 * standard 14-letter industry region code (A-N, P; no I, O, Q) published by Ofgem/Elexon and
 * used identically across all UK electricity suppliers' regional tariffs, not the same thing as
 * a DNO company name (lib/intelligence/dnoClient.ts's 7 DNO companies each cover 1-4 of these
 * 14 regions, so that lookup is the wrong granularity here).
 *
 * Was previously derived by just taking the first letter of the postcode itself (no lookup at
 * all) — that's not a real region code, so it 404'd for most postcodes (any starting with a
 * letter that isn't a valid GSP letter) and silently returned a different region's price for
 * the rest (e.g. "M" happened to be valid-shaped but is Yorkshire's code, not Manchester's).
 *
 * Prefix-based, same practical approach Octopus's own docs recommend for client-side region
 * estimation — a handful of outcodes genuinely straddle two DNO licence areas at finer
 * granularity than a postcode prefix can resolve; this covers the large majority correctly.
 */

export const OCTOPUS_GSP_REGIONS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'M',
  'N',
  'P',
] as const
export type OctopusGspRegion = (typeof OCTOPUS_GSP_REGIONS)[number]

/** Outcode prefix (1-4 chars) -> GSP letter. Longer/more specific prefixes checked first. */
const OUTCODE_GSP: Array<{ prefix: string; region: OctopusGspRegion }> = [
  // A — Eastern England
  { prefix: 'CB', region: 'A' },
  { prefix: 'CM', region: 'A' },
  { prefix: 'CO', region: 'A' },
  { prefix: 'IP', region: 'A' },
  { prefix: 'NR', region: 'A' },
  { prefix: 'AL', region: 'A' },
  { prefix: 'SG', region: 'A' },
  { prefix: 'EN', region: 'A' },
  { prefix: 'SS', region: 'A' },
  { prefix: 'IG', region: 'A' },
  { prefix: 'RM', region: 'A' },
  { prefix: 'PE', region: 'A' },
  // B — East Midlands
  { prefix: 'DE', region: 'B' },
  { prefix: 'LE', region: 'B' },
  { prefix: 'NG', region: 'B' },
  { prefix: 'NN', region: 'B' },
  { prefix: 'LN', region: 'B' },
  { prefix: 'MK', region: 'B' },
  // C — London
  { prefix: 'EC', region: 'C' },
  { prefix: 'WC', region: 'C' },
  { prefix: 'E', region: 'C' },
  { prefix: 'N', region: 'C' },
  { prefix: 'NW', region: 'C' },
  { prefix: 'SE', region: 'C' },
  { prefix: 'SW', region: 'C' },
  { prefix: 'W', region: 'C' },
  // D — Merseyside & North Wales
  { prefix: 'CH', region: 'D' },
  { prefix: 'LL', region: 'D' },
  { prefix: 'CW', region: 'D' },
  { prefix: 'L', region: 'D' },
  // E — West Midlands
  { prefix: 'B', region: 'E' },
  { prefix: 'CV', region: 'E' },
  { prefix: 'DY', region: 'E' },
  { prefix: 'WS', region: 'E' },
  { prefix: 'WV', region: 'E' },
  { prefix: 'ST', region: 'E' },
  { prefix: 'WR', region: 'E' },
  { prefix: 'HR', region: 'E' },
  { prefix: 'TF', region: 'E' },
  { prefix: 'SY', region: 'E' },
  // F — North East England
  { prefix: 'NE', region: 'F' },
  { prefix: 'SR', region: 'F' },
  { prefix: 'DH', region: 'F' },
  { prefix: 'DL', region: 'F' },
  { prefix: 'TS', region: 'F' },
  // G — North West England
  { prefix: 'M', region: 'G' },
  { prefix: 'OL', region: 'G' },
  { prefix: 'SK', region: 'G' },
  { prefix: 'WA', region: 'G' },
  { prefix: 'WN', region: 'G' },
  { prefix: 'FY', region: 'G' },
  { prefix: 'PR', region: 'G' },
  { prefix: 'BB', region: 'G' },
  { prefix: 'BL', region: 'G' },
  { prefix: 'LA', region: 'G' },
  // H — Southern England
  { prefix: 'SO', region: 'H' },
  { prefix: 'PO', region: 'H' },
  { prefix: 'BH', region: 'H' },
  { prefix: 'SP', region: 'H' },
  { prefix: 'GU', region: 'H' },
  { prefix: 'RG', region: 'H' },
  // J — South East England
  { prefix: 'BN', region: 'J' },
  { prefix: 'RH', region: 'J' },
  { prefix: 'TN', region: 'J' },
  { prefix: 'ME', region: 'J' },
  { prefix: 'CT', region: 'J' },
  { prefix: 'DA', region: 'J' },
  { prefix: 'KT', region: 'J' },
  { prefix: 'CR', region: 'J' },
  { prefix: 'SM', region: 'J' },
  { prefix: 'BR', region: 'J' },
  // K — South Wales
  { prefix: 'CF', region: 'K' },
  { prefix: 'NP', region: 'K' },
  { prefix: 'SA', region: 'K' },
  { prefix: 'LD', region: 'K' },
  // L — South West England
  { prefix: 'BS', region: 'L' },
  { prefix: 'BA', region: 'L' },
  { prefix: 'EX', region: 'L' },
  { prefix: 'PL', region: 'L' },
  { prefix: 'TR', region: 'L' },
  { prefix: 'TA', region: 'L' },
  { prefix: 'GL', region: 'L' },
  { prefix: 'SN', region: 'L' },
  { prefix: 'DT', region: 'L' },
  // M — Yorkshire
  { prefix: 'LS', region: 'M' },
  { prefix: 'BD', region: 'M' },
  { prefix: 'HD', region: 'M' },
  { prefix: 'HX', region: 'M' },
  { prefix: 'WF', region: 'M' },
  { prefix: 'YO', region: 'M' },
  { prefix: 'HU', region: 'M' },
  { prefix: 'DN', region: 'M' },
  { prefix: 'S', region: 'M' },
  // N — South & Central Scotland
  { prefix: 'EH', region: 'N' },
  { prefix: 'FK', region: 'N' },
  { prefix: 'G', region: 'N' },
  { prefix: 'KY', region: 'N' },
  { prefix: 'ML', region: 'N' },
  { prefix: 'PA', region: 'N' },
  { prefix: 'KA', region: 'N' },
  { prefix: 'TD', region: 'N' },
  { prefix: 'DG', region: 'N' },
  // P — North Scotland
  { prefix: 'AB', region: 'P' },
  { prefix: 'DD', region: 'P' },
  { prefix: 'IV', region: 'P' },
  { prefix: 'KW', region: 'P' },
  { prefix: 'PH', region: 'P' },
  { prefix: 'HS', region: 'P' },
  { prefix: 'ZE', region: 'P' },
  { prefix: 'KY9', region: 'P' },
]

const SORTED_OUTCODE_GSP = [...OUTCODE_GSP].sort((a, b) => b.prefix.length - a.prefix.length)

/** Best-effort outcode -> Octopus GSP region letter. Falls back to 'C' (London) when the
 *  postcode is missing/unrecognised, rather than an arbitrary/invalid letter. */
export function resolveOctopusRegionLetter(postcode: string | null | undefined): OctopusGspRegion {
  const compact = (postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 2) return 'C'
  for (const row of SORTED_OUTCODE_GSP) {
    if (compact.startsWith(row.prefix)) return row.region
  }
  return 'C'
}
