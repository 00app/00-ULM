/**
 * postcodes.io area names in plain form for copy: "Bristol, City of" / "City of Edinburgh" /
 * "Herefordshire, County of" → "Bristol" / "Edinburgh" / "Herefordshire". Shared by the first
 * result, the Moving agent and the Zone card "why you" line.
 */
export function cleanAreaName(raw: string | null | undefined): string | null {
  const name = String(raw ?? '')
    .trim()
    .replace(/^(City|County|Royal Borough|London Borough) of /i, '')
    .replace(/, (City|County) of$/i, '')
    .trim()
  return name || null
}
