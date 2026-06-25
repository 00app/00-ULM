/**
 * Clear Zone / Solo Focus client caches when profile postcode changes so research
 * from the previous location does not bleed into the new VM.
 */
import { clearProfileLocalityCache } from '@/lib/geocode/resolvePostcodeLocality'
import { RESEARCH_USER_ID_STORAGE_KEY } from '@/lib/zone/garyMode'
import { VISITED_CARDS_KEY } from '@/lib/zone/visitedCards'
import { CATEGORY_INTENT_STORAGE_KEY } from '@/lib/zone/categoryIntent'

const ZONE_VM_AGGREGATE_KEYS = ['heroTotals', 'zoneUnlockedCount', 'completedJourneys'] as const

/** Cleared on postcode change — prevents stale research / visit state bleeding across localities. */
const LOCAL_EXACT_DROP_ON_POSTCODE_CHANGE = [
  VISITED_CARDS_KEY,
  CATEGORY_INTENT_STORAGE_KEY,
  'property_intelligence_confidence',
  'property_imd_decile',
  'property_answer_sources',
  'zz_disliked_card_ids_v1',
  'zz_indifferent_card_ids_v1',
  'zz_offer_feedback_log_v1',
  'zz_deep_dive_in_progress',
] as const

const SESSION_EXACT_DROP_ON_POSTCODE_CHANGE = ['zz_onboarding_jit_journeys'] as const

const LOCAL_PREFIX_DROP = [
  'zz_sf_',
  'zz_solo_focus',
  'discovery_trap_',
  'zz_sentinel_',
  'zz_user_profile_memory_v1',
] as const

const SESSION_PREFIX_DROP = ['zz_sf_', 'zz_solo', 'expand_card', 'zz_summary', 'zz_discovery'] as const

export function clearZoneVmLocalCache(opts?: { preservePostcode?: string }): void {
  if (typeof window === 'undefined') return

  const preservePc = String(opts?.preservePostcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()

  try {
    for (const k of ZONE_VM_AGGREGATE_KEYS) {
      localStorage.removeItem(k)
    }
    for (const k of LOCAL_EXACT_DROP_ON_POSTCODE_CHANGE) {
      localStorage.removeItem(k)
    }
    for (const k of SESSION_EXACT_DROP_ON_POSTCODE_CHANGE) {
      sessionStorage.removeItem(k)
    }

    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith('journey_') && k.endsWith('_answers')) drop.push(k)
      if (LOCAL_PREFIX_DROP.some((p) => k.startsWith(p))) drop.push(k)
    }
    drop.forEach((k) => localStorage.removeItem(k))

    const ssDrop: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (!k) continue
      if (SESSION_PREFIX_DROP.some((p) => k.startsWith(p))) ssDrop.push(k)
    }
    ssDrop.forEach((k) => sessionStorage.removeItem(k))

    clearProfileLocalityCache()

    if (preservePc.length >= 4) {
      /* postcode preserved — research identity comes from session cookie only */
    } else {
      localStorage.removeItem(RESEARCH_USER_ID_STORAGE_KEY)
    }

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'profile_postcode',
        newValue: preservePc,
      })
    )
    window.dispatchEvent(new CustomEvent('zz-postcode-changed', { detail: { postcode: preservePc } }))
  } catch {
    /* blocked storage */
  }
}
