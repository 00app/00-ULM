/** Compact UK postcode for Neon `research_results.postcode` matching (no spaces). */
export function compactUkPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase()
}

/**
 * Match stored full postcodes when the profile only has an outcode (e.g. BN17 → BN177DH rows).
 * Full postcodes still match exactly; outcodes (≤4 chars) also prefix-match.
 */
export function sqlResearchPostcodeMatches(column: string, paramIndex: number): string {
  return `(REPLACE(COALESCE(${column}, ''), ' ', '') = $${paramIndex} OR (length($${paramIndex}) <= 4 AND REPLACE(COALESCE(${column}, ''), ' ', '') LIKE $${paramIndex} || '%'))`
}
