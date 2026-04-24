/**
 * Parse Solo Focus impact strings (morphed or static) for count-up targets.
 */
export function parseMoneyGbpFromImpactDisplay(s: unknown): number {
  if (s == null || s === '') return 0
  const raw = String(s).replace(/^£\s*/, '').trim()
  const u = raw.toUpperCase().replace(/,/g, '')
  const kMatch = u.match(/^([\d.]+)K$/)
  if (kMatch) {
    const v = parseFloat(kMatch[1])
    return Number.isFinite(v) ? Math.round(v * 1000) : 0
  }
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function parseCarbonKgFromImpactDisplay(s: unknown): number {
  if (s == null || s === '') return 0
  const str = String(s).trim()
  const tonMatch = str.match(/([\d.,]+)\s*T\b/i)
  if (tonMatch) {
    const v = parseFloat(tonMatch[1].replace(/,/g, ''))
    return Number.isFinite(v) ? Math.round(v * 1000) : 0
  }
  const kgMatch = str.match(/([\d,]+)\s*KG\b/i)
  if (kgMatch) return parseInt(kgMatch[1].replace(/,/g, ''), 10) || 0
  const legacyKg = str.match(/([\d,]+)\s*kg/i)
  if (legacyKg) return parseInt(legacyKg[1].replace(/,/g, ''), 10) || 0
  const digits = str.replace(/[^\d.]/g, '')
  return digits ? Math.round(parseFloat(digits)) || 0 : 0
}
