/**
 * Format carbon value for display (kg CO₂e). Accepts number or string.
 */
export function formatCarbon(kg: number | string): string {
  const n = typeof kg === 'string' ? Number(kg) : kg
  if (isNaN(n)) return '0 kg CO₂'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}t CO₂`
  return `${Math.round(n)} kg CO₂`
}
