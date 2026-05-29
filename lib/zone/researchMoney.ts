/**
 * Neon `research_results.saving_amount_gbp` — always `number | null` at API boundaries.
 */

export function normalizeSavingAmountGbp(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[£,\s]/g, '')
    if (!cleaned) return null
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n * 100) / 100
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}
