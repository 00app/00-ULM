/**
 * Format carbon value:
 * - 2 decimal places normally
 * - No decimals when over 100kg
 * - Change to tons when over 1000kg
 */
export const formatCarbon = (value?: number | string): string => {
  if (!value) return 'n/a'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'n/a'
  
  // Over 1000kg: convert to tons
  if (num >= 1000) {
    const tons = num / 1000
    return `${tons.toFixed(2)}t`
  }
  
  // Over 100kg: no decimals
  if (num >= 100) {
    return `${Math.round(num)}kg`
  }
  
  // Under 100kg: 2 decimal places
  return `${num.toFixed(2)}kg`
}
