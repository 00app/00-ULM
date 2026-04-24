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

/**
 * Money figure only (no £). &lt;1000 → integer string; ≥1000 → one decimal + K (e.g. 1200 → 1.2K).
 */
export function formatMoneyValue(value: number | string): string {
  const n = roundMoneyGbp(value)
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}K`
}

/**
 * Carbon mass stamp only (no CO₂). &lt;1000 kg → NKG; ≥1000 kg → one decimal + T.
 */
export function formatCarbonValue(value: number | string): string {
  const n = roundCarbonKg(value)
  if (n < 1000) return `${n}KG`
  return `${(n / 1000).toFixed(1)}T`
}

/** Parts for stamped SAVE rows (figures + optional K; £ span follows digits in `StampedMoneyGbp`). */
export function getMoneyStampParts(gbp: number): { digits: string; scaleSuffix: string | null } {
  const n = Math.round(Math.max(0, Number.isFinite(gbp) ? gbp : 0))
  if (n < 1000) return { digits: String(n), scaleSuffix: null }
  return { digits: (n / 1000).toFixed(1), scaleSuffix: 'K' }
}

/** Parts for stamped CARBON rows (caller adds CO₂ span). */
export function getCarbonStampParts(kg: number): { digits: string; massUnit: 'KG' | 'T' } {
  const n = Math.round(Math.max(0, Number.isFinite(kg) ? kg : 0))
  if (n < 1000) return { digits: String(n), massUnit: 'KG' }
  return { digits: (n / 1000).toFixed(1), massUnit: 'T' }
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
  const n = roundCarbonKg(kg)
  if (n < 1000) return `${n}KG CO₂`
  return `${(n / 1000).toFixed(1)}T CO₂`
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
  const n = roundCarbonKg(kg)
  if (n >= 1000) return { value: (n / 1000).toFixed(1), unit: 'T CO₂' }
  return { value: String(n), unit: 'KG CO₂' }
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
