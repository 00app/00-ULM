/**
 * Zone offer / source URLs — no broken gov.uk paths, no duplicate home↔grants landing pages.
 */

import type { JourneyId } from '@/lib/journeys'
import { trustedUrlForJourney, isHttpsUrl } from '@/lib/zone/trustedJourneyUrls'

/** Paths that 404 or redirect badly — never surface in BUY / source links. */
const BLOCKED_PATH_RE =
  /great-british-insulation-scheme|energy-insulation\/the-great|\/404\b/i

const GENERIC_GOV_HOSTS = new Set(['www.gov.uk', 'gov.uk'])

function hostOf(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
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
  if (BLOCKED_PATH_RE.test(trimmed)) return fallback
  if (isGenericGovHomepage(trimmed)) return fallback

  const host = hostOf(trimmed)
  if (journeyKey === 'home' && host === 'gov.uk' && /apply-boiler-upgrade|boiler-upgrade/i.test(trimmed)) {
    return trustedUrlForJourney('home')
  }
  if (journeyKey === 'grants' && /warm-homes-plan|improve-energy-efficiency/i.test(trimmed)) {
    return trustedUrlForJourney('grants')
  }

  return trimmed
}

export function isUsefulOfferHost(url: string): boolean {
  if (!isHttpsUrl(url)) return false
  if (BLOCKED_PATH_RE.test(url)) return false
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
