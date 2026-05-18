/**
 * Reject generic homepages and dead-end URLs for offer / learn links.
 */

import { isHttpsUrl, trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import type { JourneyId } from '@/lib/journeys'

const GENERIC_PATH_RE =
  /^\/(?:$|index\.html?|home(?:page)?|welcome|search|find|browse|about|contact|help|faq|news|blog)\/?$/i

const DEAD_END_PATH_RE = /\/(?:404|not-?found|error|page-not-found)(?:\/|$)/i

const DEEP_PATH_HINT_RE =
  /\/(?:apply|eligibility|claim|grant|scheme|tariff|switch|register|book|checkout|quote|offer|bus|upgrade|discount|warm-homes|boiler|chargepoint|ev-|rail|season-ticket)/i

function hostname(u: URL): string {
  return u.hostname.replace(/^www\./i, '').toLowerCase()
}

/** True when URL looks like a specific actionable page, not a site root. */
export function isDeepLinkedUkOfferUrl(url: string): boolean {
  if (!isHttpsUrl(url)) return false
  try {
    const u = new URL(url.trim())
    const path = u.pathname || '/'
    if (DEAD_END_PATH_RE.test(path)) return false
    if (GENERIC_PATH_RE.test(path)) return false
    if (path.length <= 1) return false
    if (DEEP_PATH_HINT_RE.test(path)) return true
    const segments = path.split('/').filter(Boolean)
    return segments.length >= 2 && path.length >= 12
  } catch {
    return false
  }
}

/** Sanitize to deep link or journey-trusted fallback. */
export function shieldOfferUrl(
  raw: string | null | undefined,
  journeyKey: JourneyId = 'home'
): string {
  const fallback = trustedUrlForJourney(journeyKey)
  const candidate = typeof raw === 'string' ? raw.trim() : ''
  if (isDeepLinkedUkOfferUrl(candidate)) return candidate
  return fallback
}

export function shieldUrlPair(
  offerUrl: string | null | undefined,
  sourceUrl: string | null | undefined,
  journeyKey: JourneyId = 'home'
): { offerUrl: string; sourceUrl: string } {
  const offer = shieldOfferUrl(offerUrl, journeyKey)
  const sourceCandidate = typeof sourceUrl === 'string' ? sourceUrl.trim() : ''
  const source = isDeepLinkedUkOfferUrl(sourceCandidate) ? sourceCandidate : offer
  return { offerUrl: offer, sourceUrl: source }
}
