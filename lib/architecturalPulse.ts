/** Post–profile-summary handoff: one-word rhythmic pulse before Zone grid punch-through. */

export const ARCHITECTURAL_PULSE_WORDS = [
  'connect',
  'search',
  'scape',
  'analyse',
  'audit',
  'done.',
] as const

/** Mechanical lock: 1.2s per beat (Marvin opacity ticker). */
export const ARCHITECTURAL_PULSE_DWELL_MS = 1200

/** Max wait after DONE. before punch-through if scrape-sync is still in flight. */
export const ZONE_READY_MAX_WAIT_MS = 14_000

/** Clean Birth: max wait on post-answer pulse before Zone reveal (card + words). */
export const CLEAN_BIRTH_PULSE_MAX_WAIT_MS = 4_500

export const SESSION_SUMMARY_TO_ZONE = 'zz_summary_to_zone'

export type ZoneReadinessInput = {
  hydrated: boolean
  vmResolved: boolean
  scrapePostcode: string
}

/** Zone punch-through gate: VM + research feed ready (or no postcode to hydrate). */
export function computeIsZoneReady(input: ZoneReadinessInput): boolean {
  if (!input.hydrated) return false
  const pc = input.scrapePostcode.replace(/\s+/g, '').trim()
  if (pc.length < 4) return true
  return input.vmResolved
}
