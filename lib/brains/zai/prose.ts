/** Collapse repeated "in bn17 area" / locality stutters from model + opener stacking. */
export function dedupeLocalityInProse(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  t = t.replace(/(\bin\s+[a-z0-9]+\s+area,?\s*){2,}/gi, (match) => {
    const first = match.match(/\bin\s+[a-z0-9]+\s+area,?/i)?.[0] ?? ''
    return first.endsWith(',') ? first : `${first},`
  })
  t = t.replace(/(\bin\s+[a-z][a-z\s'-]{2,40},?\s*){2,}/gi, (match) => {
    const first = match.match(/\bin\s+[a-z][a-z\s'-]{2,40},?/i)?.[0] ?? ''
    return first
  })
  return t.replace(/\s+/g, ' ').trim()
}

export function textAlreadyHasLocality(text: string, locality?: string | null, postcode?: string | null): boolean {
  const lower = text.toLowerCase()
  if (locality?.trim()) {
    const loc = locality.trim().toLowerCase()
    if (lower.includes(loc)) return true
    if (lower.includes(`in ${loc}`)) return true
  }
  if (postcode?.trim()) {
    const outward = postcode.replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)/)?.[1]
    if (outward && lower.includes(outward.toLowerCase())) return true
    if (outward && lower.includes(`${outward.toLowerCase()} area`)) return true
  }
  return false
}
