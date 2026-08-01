/**
 * Clear Zone / Solo Focus client caches when profile postcode changes so research
 * from the previous location does not bleed into the new VM.
 *
 * The rule for what goes and what stays: does this describe the PLACE or the PERSON? Local
 * research, council context, locality labels and grid figures are place-scoped and must be
 * dropped. Loop answers, likes and completions describe the person and follow them to the new
 * address — dropping those is silent data loss, not cache hygiene.
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
      /**
       * Loop answers survive a house move.
       *
       * These keys were being dropped wholesale, which quietly destroyed every loop answer the
       * moment someone corrected or changed their postcode. That mattered little when loop
       * answers only fed a badge; they now gate the action library, so wiping them silently
       * removes cards the user had unlocked and resets progress they can see.
       *
       * The distinction is whether an answer is about the PLACE or about the PERSON. Local
       * research, council context and grid figures are about the place and must go. Whether you
       * compost, repair before replacing, or have already switched supplier is about you, and is
       * just as true at the new address.
       */
      if (k.startsWith('journey_') && k.endsWith('_answers')) continue
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
