import { INTRO_TYPE_MOTION_SCALE } from '@/lib/animations'
import { formatMoneyValue, compactAuditValue } from '@/lib/format'
import { formatTimeOfDayGreeting } from '@/lib/zone/timeOfDay'

/** Warm Marvin + Roboto before summary ticker / intro type (avoids sans-serif flash). */
export function preloadAppFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  const marvinFamily = '"Marvin Visions Bold"'
  return Promise.all([
    document.fonts.load('700 16px var(--font-roboto)'),
    document.fonts.load('800 16px var(--font-roboto)'),
    document.fonts.load(`700 20px ${marvinFamily}`),
    document.fonts.load(`900 50px ${marvinFamily}`),
    document.fonts.load(`900 70px ${marvinFamily}`),
    document.fonts.load(`900 90px ${marvinFamily}`),
    document.fonts.ready,
  ])
    .then(() => undefined)
    .catch(() => undefined)
}

/** Glitch logo beat — keep in sync with `--zz-glitch-anim-ms` in globals.css */
export const GLITCH_ANIM_MS = Math.round(469 * INTRO_TYPE_MOTION_SCALE)

/** Post–profile-summary handoff: one-word rhythmic pulse before Zone grid punch-through. */

export const ARCHITECTURAL_PULSE_WORDS = [
  'connect',
  'search',
  'scape',
  'analyse',
  'audit',
  'done.',
] as const

/** Legacy constant — pulse uses per-word `atomicWordHoldMs` × `INTRO_TYPE_MOTION_SCALE` in `ArchitecturalPulse`. */
export const ARCHITECTURAL_PULSE_DWELL_MS = Math.round(1200 * INTRO_TYPE_MOTION_SCALE)

/** Max wait after DONE. before punch-through if scrape-sync is still in flight. */
export const ZONE_READY_MAX_WAIT_MS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 90_000 : 14_000

/** Second/third scrape-sync attempts after cold webpack compile (dev only). */
export const ZONE_SCRAPE_SYNC_RETRY_WAIT_MS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 120_000 : 14_000

export const ZONE_SCRAPE_SYNC_MAX_ATTEMPTS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 3 : 1

/** Clean Birth: max wait on post-answer pulse before Zone reveal (card + words). */
export const CLEAN_BIRTH_PULSE_MAX_WAIT_MS = 4_500

/** Post–loop-answer pulse — two beats only (not full summary handoff). */
export const CLEAN_BIRTH_PULSE_WORDS = ['audit', 'done.'] as const

export const SESSION_SUMMARY_TO_ZONE = 'zz_summary_to_zone'

export type ZoneReadinessInput = {
  hydrated: boolean
  vmResolved: boolean
  scrapePostcode: string
}

export type ZoneWelcomeCopy = {
  timeOfDayLine: string
  nameLine: string
  localityLine: string
  savingsMoneyLine: string
  savingsCarbonLine: string
  /** e.g. "we've found 9 things," */
  foundCountLine: string
}

/**
 * SSR-safe placeholder — real copy depends on the visitor's local clock (timeOfDayLine) and
 * localStorage (nameLine), neither available during server render. Rendering buildZoneWelcomeCopy's
 * real output on the server produces a text mismatch against the client's first paint (React
 * hydration error #418) whenever the server's timezone/hour differs from the browser's, or the
 * profile has a saved name (server always sees "Guest."). Use this fixed, deterministic value until
 * the caller has confirmed it's running client-side post-mount, then swap to the real copy.
 */
export const ZONE_WELCOME_SSR_SAFE_EMPTY: ZoneWelcomeCopy = {
  timeOfDayLine: '',
  nameLine: '',
  foundCountLine: '',
  localityLine: '',
  savingsMoneyLine: '',
  savingsCarbonLine: '',
}

/** Profile hero card — under biggest-win category headline (Roboto body). */
export const ZONE_PROFILE_HERO_MISSION =
  'with zero zero you save money and do your bit for the planet.'

/** Zone welcome — savings potential from grid journey + tip cards (≥1k → K/T shorthand). */
export function buildZoneWelcomeCopy(
  name: string | undefined,
  completedCount: number,
  gridSavingsMoneyGbp: number,
  gridSavingsCarbonKg: number,
  locality?: string | null
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
  const localityName = locality?.trim().split(',')[0].trim() || null
  const count = Math.max(1, completedCount)
  const thingLabel = count === 1 ? 'thing' : 'things'

  return {
    timeOfDayLine: formatTimeOfDayGreeting(),
    nameLine: `${first}.`,
    foundCountLine: `we've found ${count} ${thingLabel},`,
    // Non-breaking space before "and" — stops it orphaning alone on the next line (typographic widow).
    localityLine: `that could save you ${moneyLabel} and`,
    savingsMoneyLine: `reduce your co2 by ${carbonLabel}.`,
    savingsCarbonLine: '',
  }
}

/** Zone punch-through gate: VM + research feed ready (or no postcode to hydrate). */
export function computeIsZoneReady(input: ZoneReadinessInput): boolean {
  if (!input.hydrated) return false
  const pc = input.scrapePostcode.replace(/\s+/g, '').trim()
  if (pc.length < 4) return true
  return input.vmResolved
}
