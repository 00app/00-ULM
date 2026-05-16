/**
 * Gary / demo research identity — links BN17 postcode rows to a stable UUID for scrape-sync + Neon.
 * Hot path tables: `research_results`, `journey_answers`, `journey_answers_jsonb`, `user_profiles` mirror.
 * Legacy `micro_answers` (FK → cards) is unused in the intelligence loop — do not write there.
 */

import { safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'

export const GARY_RESEARCH_USER_ID = '00000000-0000-4000-a000-000000000000'

export const GARY_MODE_STORAGE_KEY = 'zz_gary_mode'
export const RESEARCH_USER_ID_STORAGE_KEY = 'zz_research_user_id'

export function isGaryModeActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (safeGetItem(GARY_MODE_STORAGE_KEY) === '1') return true
    const pc = (safeGetItem('profile_postcode') ?? '').replace(/\s+/g, '').toUpperCase()
    if (pc.startsWith('BN17')) return true
    const uid = safeGetItem(RESEARCH_USER_ID_STORAGE_KEY)
    return uid === GARY_RESEARCH_USER_ID
  } catch {
    return false
  }
}

/** Pin Gary UUID + mode flag when demo postcode is in play. */
export function ensureGaryModeForPostcode(postcode: string | null | undefined): void {
  if (typeof window === 'undefined') return
  const pc = String(postcode ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
  if (!pc.startsWith('BN17')) return
  safeSetItem(RESEARCH_USER_ID_STORAGE_KEY, GARY_RESEARCH_USER_ID)
  safeSetItem(GARY_MODE_STORAGE_KEY, '1')
}

/** Session user wins; else Gary mode UUID; else explicit browser research id. */
export function resolveClientResearchUserId(): string | null {
  if (typeof window === 'undefined') return null
  if (isGaryModeActive()) return GARY_RESEARCH_USER_ID
  try {
    for (const key of [RESEARCH_USER_ID_STORAGE_KEY, 'user_id', 'profile_user_id']) {
      const raw = safeGetItem(key)?.trim()
      if (raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return raw
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function appendResearchUserIdQuery(url: string): string {
  const uid = resolveClientResearchUserId()
  if (!uid) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}user_id=${encodeURIComponent(uid)}`
}
