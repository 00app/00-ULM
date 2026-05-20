import { formatMoneyValue, compactAuditValue } from '@/lib/format'

/** Warm Marvin + Roboto while intro glitch runs. */
export function preloadAppFonts(): void {
  if (typeof document === 'undefined') return
  void Promise.all([
    document.fonts.load('700 16px var(--font-roboto)'),
    document.fonts.load('800 16px var(--font-roboto)'),
    document.fonts.load('bold 20px "Marvin Visions Bold"'),
    document.fonts.load('bold 50px "Marvin Visions Bold"'),
  ]).catch(() => {})
}

/** Glitch logo beat — keep in sync with `.zz-glitch` in globals.css */
export const GLITCH_ANIM_MS = 469

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

export type ZoneWelcomeCopy = {
  nameLine: string
  savingsLeadLine: string
  savingsMoneyLine: string
  savingsCarbonLine: string
}

/** Zone welcome — savings potential from grid journey + tip cards (≥1k → K/T shorthand). */
export function buildZoneWelcomeCopy(
  name: string | undefined,
  _completedCount: number,
  gridSavingsMoneyGbp: number,
  gridSavingsCarbonKg: number
): ZoneWelcomeCopy {
  const raw = ((name ?? '').trim().split(/\s+/)[0] || 'guest').toLowerCase()
  const first = raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : 'Guest'
  const money = Math.max(0, Math.round(gridSavingsMoneyGbp))
  const carbon = Math.max(0, Math.round(gridSavingsCarbonKg))
  const moneyLabel = `£${formatMoneyValue(money)}`
  const carbonCompact = compactAuditValue(carbon, 'carbon')
  const carbonLabel =
    carbonCompact.suffix === 't'
      ? `${carbonCompact.figure}t co2`
      : `${carbonCompact.figure}kg co2`

  return {
    nameLine: `${first}.`,
    savingsLeadLine: 'we could save',
    savingsMoneyLine: `you ${moneyLabel} and`,
    savingsCarbonLine: `${carbonLabel}/year.`,
  }
}

/** Zone punch-through gate: VM + research feed ready (or no postcode to hydrate). */
export function computeIsZoneReady(input: ZoneReadinessInput): boolean {
  if (!input.hydrated) return false
  const pc = input.scrapePostcode.replace(/\s+/g, '').trim()
  if (pc.length < 4) return true
  return input.vmResolved
}
