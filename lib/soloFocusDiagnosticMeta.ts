import type { JourneyId } from '@/lib/journeys'
import { PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

/** Extract display name after "Supplied by …" (tips / Rock). */
export function parseSuppliedByProviderName(sourceLabel?: string | null): string | null {
  const s = sourceLabel?.trim()
  if (!s) return null
  const m = s.match(/^supplied\s+by\s+(.+)$/i)
  return m ? m[1].trim() : null
}

export function pickPrimaryHttpUrl(...urls: (string | undefined | null)[]): string {
  for (const u of urls) {
    const t = typeof u === 'string' ? u.trim() : ''
    if (t.startsWith('http')) return t
  }
  return ''
}

export function fallbackDiagnosticUrl(journeyId?: JourneyId | null): string {
  if (journeyId === 'home' || !journeyId) return PRICE_CAP_SOURCE_URL
  return trustedUrlForJourney(journeyId)
}
