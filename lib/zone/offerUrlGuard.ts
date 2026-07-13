/**
 * Zone offer / source URLs — no broken gov.uk paths, no cross-journey landing page conflicts.
 */

import type { JourneyId } from '@/lib/journeys'
import { trustedUrlForJourney, isHttpsUrl } from '@/lib/zone/trustedJourneyUrls'

/** Paths that 404 or redirect badly — never surface in BUY / source links. */
const BLOCKED_PATH_RE =
  /great-british-insulation-scheme|energy-insulation\/the-great|\/404\b|moneysavingexpert\.com\/utilities\/how-to-switch|moneysavingexpert\.com\/utilities\/?$/i

const INTERNAL_HOST_RE =
  /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i

const VERCEL_PREVIEW_HOST_RE = /\.vercel\.app$/i

export function isInternalOrPreviewOfferUrl(url: string): boolean {
  const trimmed = typeof url === 'string' ? url.trim() : ''
  if (!trimmed) return false
  try {
    const h = new URL(trimmed).hostname.toLowerCase()
    if (INTERNAL_HOST_RE.test(h)) return true
    if (VERCEL_PREVIEW_HOST_RE.test(h)) return true
    return false
  } catch {
    return false
  }
}

/** Home-only BUS landing — must not appear on other journeys. */
function isHomeBoilerUpgradeUrl(url: string): boolean {
  return /apply-boiler-upgrade|boiler-upgrade/i.test(url)
}

/** Grants-only warm-homes paths — grants journey is retired, so these never belong on any tile. */
function isGrantsWarmHomesUrl(url: string): boolean {
  return /warm-homes-plan|improve-energy-efficiency/i.test(url)
}

/** True when URL topic conflicts with the tile journey category. */
export function offerUrlConflictsWithJourney(url: string, journeyKey: JourneyId): boolean {
  const trimmed = url.trim()
  if (journeyKey === 'home' && isHomeBoilerUpgradeUrl(trimmed)) return false
  if (journeyKey !== 'home' && isHomeBoilerUpgradeUrl(trimmed)) return true
  if (isGrantsWarmHomesUrl(trimmed)) return true
  if (journeyKey !== 'utilities' && isOfgemPriceCapUrl(trimmed)) return true
  return false
}

export function passesZoneOfferUrlGuard(
  raw: string | undefined | null,
  journeyKey: JourneyId
): boolean {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!isHttpsUrl(trimmed)) return false
  if (isInternalOrPreviewOfferUrl(trimmed)) return false
  if (isKnownDeadOfferUrl(trimmed)) return false
  if (isGenericGovHomepage(trimmed)) return false
  if (offerUrlConflictsWithJourney(trimmed, journeyKey)) return false
  return true
}

/** Persist path — null when URL fails guard (never substitute trusted fallback into Neon). */
export function sanitizeZoneOfferUrlForPersist(
  raw: string | undefined | null,
  journeyKey: JourneyId
): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return null
  if (!passesZoneOfferUrlGuard(trimmed, journeyKey)) {
    console.warn('[offerUrlGuard] offer_url rejected:', trimmed.slice(0, 160))
    return null
  }
  return trimmed
}

export function isKnownDeadOfferUrl(url: string): boolean {
  const trimmed = typeof url === 'string' ? url.trim() : ''
  if (!trimmed) return false
  return BLOCKED_PATH_RE.test(trimmed)
}

const GENERIC_GOV_HOSTS = new Set(['www.gov.uk', 'gov.uk'])

function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Ofgem price-cap / household advice — utilities tile only. */
export function isOfgemPriceCapUrl(url: string): boolean {
  const trimmed = url.trim()
  return /ofgem\.gov\.uk/i.test(trimmed) && /price-cap|energy-advice/i.test(trimmed)
}

function isGenericGovHomepage(url: string): boolean {
  try {
    const u = new URL(url.trim())
    const h = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (h !== 'gov.uk') return false
    const p = u.pathname.replace(/\/$/, '') || '/'
    return p === '/' || p === ''
  } catch {
    return false
  }
}

/** Prefer publisher homepages over regulator homepages for user-facing CTAs. */
export function sanitizeZoneOfferUrl(
  raw: string | undefined | null,
  journeyKey: JourneyId
): string {
  const fallback = trustedUrlForJourney(journeyKey)
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!isHttpsUrl(trimmed)) return fallback
  if (isInternalOrPreviewOfferUrl(trimmed)) return fallback
  if (isKnownDeadOfferUrl(trimmed)) return fallback
  if (isGenericGovHomepage(trimmed)) return fallback
  if (offerUrlConflictsWithJourney(trimmed, journeyKey)) {
    // offerUrlConflictsWithJourney only recognizes 3 specific known cross-category URL patterns
    // (Boiler Upgrade Scheme, Warm Homes grant, Ofgem price-cap) — it is not a general topic
    // classifier, so this branch firing at all is a genuine signal worth having in logs. A
    // silently-swapped URL here is invisible otherwise; a future scrape source returning a
    // mismatched URL this guard doesn't recognize would pass through with no trace at all.
    console.warn(
      `[offerUrlGuard] ${journeyKey} offer_url conflicted, using trusted fallback:`,
      trimmed.slice(0, 160)
    )
    return fallback
  }
  if (journeyKey !== 'utilities' && isOfgemPriceCapUrl(trimmed)) return fallback

  const host = hostOf(trimmed)
  if (journeyKey === 'home' && host === 'gov.uk' && isHomeBoilerUpgradeUrl(trimmed)) {
    return trustedUrlForJourney('home')
  }

  return trimmed
}

export function isUsefulOfferHost(url: string): boolean {
  if (!isHttpsUrl(url)) return false
  if (isInternalOrPreviewOfferUrl(url)) return false
  if (isKnownDeadOfferUrl(url)) return false
  if (isGenericGovHomepage(url)) return false
  const h = hostOf(url)
  if (!h) return false
  if (GENERIC_GOV_HOSTS.has(h)) {
    try {
      const p = new URL(url).pathname
      return p.length > 12 && !/^\/browse\/?$/i.test(p)
    } catch {
      return false
    }
  }
  return true
}
