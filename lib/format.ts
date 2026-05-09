/**
 * Display formats — v1.8.12 shorthand: ≥1000 → K / T, units KG (uppercase).
 */

/** Normalised GBP integer for threshold formatting (≥0). */
function roundMoneyGbp(value: number | string): number {
  if (typeof value === 'number') {
    return Math.round(Math.max(0, Number.isFinite(value) ? value : 0))
  }
  const s = String(value).replace(/^£\s*/, '').trim()
  const u = s.replace(/,/g, '').toUpperCase()
  const k = u.match(/^([\d.]+)K$/)
  if (k) {
    const v = Number.parseFloat(k[1])
    return Number.isFinite(v) ? Math.round(v * 1000) : 0
  }
  const n = Number.parseFloat(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? Math.round(Math.max(0, n)) : 0
}

/** Normalised kg for carbon threshold (≥0). */
function roundCarbonKg(value: number | string): number {
  if (typeof value === 'number') {
    return Math.round(Math.max(0, Number.isFinite(value) ? value : 0))
  }
  return Math.round(Math.max(0, parseCarbonKgFromDisplay(String(value))))
}

function trimTrailingDecimal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

/**
 * Universal compact audit formatter.
 * - money: 12480 -> 12.5k, 12000 -> 12k
 * - carbon: 1200 -> 1.2t, 1000 -> 1t
 */
export function compactAuditValue(
  value: number | string,
  kind: 'money' | 'carbon'
): { figure: string; suffix: string | null } {
  if (kind === 'money') {
    const n = roundMoneyGbp(value)
    if (n < 1000) return { figure: String(n), suffix: null }
    return { figure: trimTrailingDecimal(n / 1000), suffix: 'k' }
  }
  const n = roundCarbonKg(value)
  if (n < 100) return { figure: String(n), suffix: 'kg' }
  return { figure: trimTrailingDecimal(n / 1000), suffix: 't' }
}

/** Money figure only (no £). */
export function formatMoneyValue(value: number | string): string {
  const compact = compactAuditValue(value, 'money')
  return `${compact.figure}${compact.suffix ?? ''}`
}

/**
 * Carbon mass stamp only (no CO₂). &lt;1000 kg → NKG; ≥1000 kg → one decimal + T.
 */
export function formatCarbonValue(value: number | string): string {
  const compact = compactAuditValue(value, 'carbon')
  return `${compact.figure}${compact.suffix ?? ''}`
}

/** Parts for stamped SAVE rows (figures + optional K; £ span follows digits in `StampedMoneyGbp`). */
export function getMoneyStampParts(gbp: number): { digits: string; scaleSuffix: string | null } {
  const compact = compactAuditValue(gbp, 'money')
  return { digits: compact.figure, scaleSuffix: compact.suffix }
}

/** Parts for stamped CARBON rows (caller adds CO₂ span). */
export function getCarbonStampParts(kg: number): { digits: string; massUnit: 'kg' | 't' } {
  const compact = compactAuditValue(kg, 'carbon')
  return {
    digits: compact.figure,
    massUnit: compact.suffix === 't' ? 't' : 'kg',
  }
}

/** Parse £ display including K shorthand → GBP number. */
export function parseMoneyGbpFromDisplay(s: string): number {
  const t = s.replace(/[£,\s]/g, '').trim().toUpperCase()
  const k = t.match(/^([\d.]+)K$/)
  if (k) {
    const v = Number.parseFloat(k[1])
    return Number.isFinite(v) ? Math.round(v * 1000) : 0
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** Parse carbon display strings (legacy + v1.8.12) back to kg for totals. */
export function parseCarbonKgFromDisplay(s: string): number {
  const u = s.trim().toUpperCase()
  const tMatch = u.match(/([\d.]+)\s*T/)
  if (tMatch) {
    const v = Number.parseFloat(tMatch[1])
    return Number.isFinite(v) ? v * 1000 : 0
  }
  const kgMatch = u.match(/([\d,.]+)\s*KG/i)
  if (kgMatch) {
    const v = Number.parseFloat(kgMatch[1].replace(/,/g, ''))
    return Number.isFinite(v) ? v : 0
  }
  const legacy = Number.parseFloat(u.replace(/[^\d.]/g, ''))
  return Number.isFinite(legacy) ? legacy : 0
}

/**
 * Zone card / hero money string with £ prefix (e.g. £1.2K, £500).
 * v1.8.14 layout: one decimal + K from 1k up — keeps stamped figures short beside 100px circles.
 */
export function formatZoneCardMoney(gbp: number): string {
  return `£${formatMoneyValue(gbp)}`
}

/**
 * Animated hero / summary: number part only (caller adds £ or unit span).
 */
export function formatHeroMoneyFigure(n: number): string {
  return formatMoneyValue(n)
}

/**
 * Animated hero carbon: main figure + uppercase unit suffix (no CO₂ subscript in suffix token — use separate aria).
 */
export function formatHeroCarbonParts(n: number): { figure: string; unit: string } {
  const r = Math.round(Math.max(0, n))
  if (r >= 1000) return { figure: (r / 1000).toFixed(1), unit: 'T CO₂' }
  return { figure: String(r), unit: 'KG CO₂' }
}

/**
 * Format carbon value for display (kg CO₂e). ≥1000 kg → XT CO₂; else N KG CO₂.
 */
export function formatCarbon(kg: number | string): string {
  const compact = compactAuditValue(kg, 'carbon')
  return `${compact.figure}${compact.suffix ?? ''} CO₂`
}

/**
 * Impact display: money with K for thousands (e.g. 7.5K). Under 1000: integer. No £ prefix.
 * Matches v1.8.14 stamped row — one decimal + K from 1k up.
 */
export function formatMoneyImpact(value: number | string): string {
  return formatMoneyValue(value)
}

/**
 * Impact display: carbon — prose split (value + unit). Use stamped UI via {@link getCarbonStampParts} + CO₂ spans.
 */
export function formatCarbonImpact(kg: number | string): { value: string; unit: string } {
  const compact = compactAuditValue(kg, 'carbon')
  return { value: compact.figure, unit: `${compact.suffix ?? ''} CO₂`.trim() }
}

/**
 * WCAG: Screen-reader label for Summary grid values (e.g. "4,200 pounds per year").
 */
export function getSummaryValueAriaLabel(label: string, value: string, unit: string): string {
  if (value === '—') return `${label}: no data`
  const lower = unit.toLowerCase()
  if (lower.includes('/yr') || lower === '/yr') return `${label}: ${value} pounds per year`
  if (lower.includes('gco2') || lower.includes('co₂')) return `${label}: ${value} grams CO2 per kilowatt hour`
  if (lower.includes('%')) return `${label}: ${value}`
  return `${label}: ${value} ${unit}`.trim()
}
