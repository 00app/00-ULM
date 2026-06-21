/**
 * Map EPC register fields to onboarding hints — never overrides explicit user choices.
 */

export function mapEpcPropertyTypeToHomeTypeHint(
  propertyType?: string | null
): 'FLAT' | 'HOUSE' | null {
  const t = (propertyType ?? '').trim().toLowerCase()
  if (!t) return null
  if (t.includes('flat') || t.includes('maisonette') || t.includes('apartment')) return 'FLAT'
  if (t.includes('house') || t.includes('bungalow') || t.includes('cottage') || t.includes('detached')) {
    return 'HOUSE'
  }
  return null
}
