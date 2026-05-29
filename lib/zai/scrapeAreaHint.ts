/**
 * Postcode-first scrape hints — never hardcode sample postcodes or counties in UI.
 */
export function scrapeAreaHintFromLocality(
  locality?: string | null,
  fallback = 'UK'
): string {
  const place = String(locality ?? '').trim()
  return place.length >= 2 ? place : fallback
}
