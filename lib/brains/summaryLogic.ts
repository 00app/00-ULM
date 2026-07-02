/**
 * Profile summary — dynamic copy from employment, postcode, and local grid (council + carbon intensity).
 * Client supplies data from /api/local-intelligence (server uses getLocalData).
 *
 * ## Kinetic £ / CO₂ (same “cord” as Zone cards)
 * `app/profile/summary` loads all `journey_*_answers` from localStorage and the same profile fields as Zone,
 * then runs **`buildUserImpact({ profile, journeyAnswers })`** (`lib/brains/buildUserImpact.ts`).
 * - **Spend anchor:** `max(BASELINE_2026_CAP_GBP, impact.totals.totalMoney)` — not below the 2026 cap baseline.
 * - **Kinetic £ / kg:** modelled from **`buildUserImpact`** (`totals` when journey answers exist, else **`summaryWaste`** profile baseline). Neon **`genomeSavingsMoney`** wins for £ when `/api/summary` returns it.
 * These are **modelled** totals from answers + UK defaults, not the Neon **`research_results`** row (that path is scrape-sync / Hermes / Gemini “Architect” on Zone).
 */

import type { EmploymentStatus } from './types'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'

function purgeYourAreaCopy(s: string): string {
  return s.replace(/\bin your area\.?/gi, '').replace(/\s+/g, ' ').trim()
}

function looksLikeUkPostcode(value: string): boolean {
  const t = value.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(t)
}

/** Outward code only (e.g. BN17) — not a town name for summary copy. */
export function looksLikeOutcodeOnly(value: string): boolean {
  const t = value.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(t) && t.length >= 2 && t.length <= 4
}

function isGenericUkPlaceLabel(value: string): boolean {
  const lower = value.toLowerCase().replace(/\s+/g, ' ')
  return (
    lower === 'uk' ||
    lower === 'the uk' ||
    lower === 'united kingdom' ||
    lower === 'great britain' ||
    lower === 'england' ||
    lower === 'unknown'
  )
}

/** True when label is safe to show as a settlement / council in summary beats. */
export function isRealLocalityLabel(value: string | null | undefined): boolean {
  const t = String(value ?? '').trim()
  if (!t || isGenericUkPlaceLabel(t)) return false
  if (looksLikeUkPostcode(removePostcodeTokens(t))) return false
  if (/ council$/i.test(t)) return false
  return true
}

/** Outward code (BN17) — acceptable summary beat when parish name is not yet resolved. */
export function isSummaryOutcodeFallback(value: string | null | undefined): boolean {
  const t = String(value ?? '').trim()
  return Boolean(t) && looksLikeOutcodeOnly(t)
}

function outwardPostcodeFromDisplay(postcodeDisplay: string): string {
  const compact = postcodeDisplay.replace(/\s+/g, '').toUpperCase()
  const m = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)
  return m?.[1] ?? ''
}

function removePostcodeTokens(value: string): string {
  return value
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SummaryLocalContext {
  council: string
  region?: string
  localCarbonG?: number
  ward?: string
  locality?: string
  outcode?: string
  country?: string
}

export interface ProfileSummaryNarrativeInput {
  employment_status?: EmploymentStatus
  /** First name (or preferred given name) for the kinetic “HELLO …” beat. */
  displayName?: string
  /** Fallback when Postcodes.io has no settlement (often same as council). */
  councilLabel: string
  /** Raw postcode for display, e.g. "SW1A 1AA" */
  postcodeDisplay: string
  local: SummaryLocalContext | null
  totalsMoney: number
  totalsCarbon: number
  annualWasteCash: number
  annualWasteCarbon: number
  /**
   * Neon `user_genome` aggregated £ (Hermes wins) — when set, the kinetic £ beat uses this
   * instead of modelled “slack” (`annualWasteCash`) so Summary matches Zone handoff.
   */
  genomeSavingsMoney?: number
}

/** Prefer parish / ward / council for locality-led summary beats. */
export function resolveSummaryAreaLabel(input: ProfileSummaryNarrativeInput): string {
  const loc = input.local
  const li: LocalIntelligence | null = loc
    ? {
        council: loc.council,
        region: loc.region ?? loc.council,
        ward: loc.ward,
        locality: loc.locality,
        outcode: loc.outcode,
        localCarbonG: loc.localCarbonG,
        country: loc.country,
      }
    : null

  // Summary lock: never surface raw postcode in the area label.
  const fromLocal = li ? formatLocationDisplayName(li, input.postcodeDisplay).trim() : ''
  const rawCouncilLabel = (input.councilLabel || '').trim()
  const cleanedCouncilLabel = removePostcodeTokens(rawCouncilLabel)
  const fromCouncilLabel = isRealLocalityLabel(cleanedCouncilLabel) ? cleanedCouncilLabel : ''
  const fromStoredCouncil =
    loc?.council?.trim() &&
    isRealLocalityLabel(loc.council.trim())
      ? purgeYourAreaCopy(loc.council.trim())
      : ''
  const cachedOutcode = (loc?.outcode || outwardPostcodeFromDisplay(input.postcodeDisplay)).trim()
  const outcodeFallback =
    isSummaryOutcodeFallback(cachedOutcode) ? cachedOutcode : ''

  const area =
    (isRealLocalityLabel(fromLocal) ? fromLocal : '') ||
    fromCouncilLabel ||
    fromStoredCouncil ||
    outcodeFallback ||
    'the UK'
  return purgeYourAreaCopy(area)
}

/** Synchronous label for summary first paint — never a raw postcode token. */
export function resolveImmediateSummaryCouncilLabel(input: {
  postcodeDisplay: string
  cachedLocality?: string | null
  locationName?: string | null
  local?: SummaryLocalContext | null
}): string {
  const cached = input.cachedLocality?.trim()
  if (cached && isRealLocalityLabel(cached)) return cached

  const locationName = input.locationName?.trim()
  if (locationName && isRealLocalityLabel(locationName)) return locationName

  if (input.local) {
    const li: LocalIntelligence = {
      council: input.local.council,
      region: input.local.region ?? input.local.council,
      ward: input.local.ward,
      locality: input.local.locality,
      outcode: input.local.outcode,
      localCarbonG: input.local.localCarbonG,
      country: input.local.country,
    }
    const fromLocal = formatLocationDisplayName(li, input.postcodeDisplay).trim()
    if (isRealLocalityLabel(fromLocal)) return fromLocal
  }

  return ''
}

/** One-line status under the kinetic cycle (Roboto). */
export function buildSummaryStatusLine(input: ProfileSummaryNarrativeInput): string {
  const place = purgeYourAreaCopy(resolveSummaryAreaLabel(input))
  const g = input.local?.localCarbonG
  if (g != null && Number.isFinite(g)) {
    return purgeYourAreaCopy(`${place} · grid ≈ ${Math.round(g)} gCO₂/kWh`)
  }
  return purgeYourAreaCopy(place)
}

function gridMatchPhrase(areaDisplay: string): string {
  const t = purgeYourAreaCopy(areaDisplay.replace(/\s+/g, ' ').trim())
  if (!t || t === 'the UK') return 'We’ve matched your local grid intensity to your profile.'
  const poss = /s$/i.test(t) ? `${t}'` : `${t}'s`
  return `We’ve matched ${poss} grid intensity to your profile.`
}

/** Primary "win lens" by employment — used in kinetic beats and reveal copy. */
export function employmentWinFocus(
  employment: EmploymentStatus | undefined,
  areaDisplay: string
): {
  kineticTag: string
  headline: string
  body: string
} {
  switch (employment) {
    case 'STUDENT':
      return {
        kineticTag: 'BUDGET',
        headline: 'Small wins, shared bills.',
        body:
          'Student: we weight low-upfront habits — batch cooking, standby off, fair meter splits in shared housing — and keep grant routes when your postcode supports them.',
      }
    case 'EMPLOYED':
      return {
        kineticTag: 'BENEFITS',
        headline: 'Salary sacrifice beats list price.',
        body: `Employed: salary-sacrifice EVs and cycle schemes often beat cash purchases; workplace pension and perks stack with commute and travel wins. ${gridMatchPhrase(areaDisplay)}`,
      }
    case 'BETWEEN_JOBS':
      return {
        kineticTag: 'HABITS',
        headline: 'Zero-upfront wins first.',
        body:
          'Between jobs: we weight low-barrier habits — cooler washes, phantom load, radiator tweaks — and hardship-capable grant routes. Local grid data still shapes what’s worth doing where you live.',
      }
    default:
      return {
        kineticTag: 'WINS',
        headline: 'Your numbers are live.',
        body: `We’ve run your profile against 2026 UK defaults and ${areaDisplay === 'the UK' ? 'UK-wide' : areaDisplay} signals. Employment status fine-tunes whether we lead with benefits, budget habits, or grants — add it in profile anytime.`,
      }
  }
}

/**
 * Locality beat for the summary pulse: multi-word labels split across two lines for balance; **single long
 * placenames stay one token** so `IntroWordCycle` can scale font + `fitToViewportPaddingPx` (40px each side) only.
 */
export function formatSummaryLocalityKineticToken(areaLabel: string): string {
  const t = purgeYourAreaCopy(areaLabel || 'the UK').trim()
  if (!t || t === 'the UK') return 'the UK'
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2)
    return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`
  }
  return t
}

/**
 * Profile summary — one beat at a time (`IntroWordCycle` + 40px horizontal inset on the summary page).
 * On-screen sequence: **HELLO → first name → based on your profile → people in → locality** →
 * waste → £… → and → … CO₂ → per → year.
 * £ / CO₂: see file header — `buildUserImpact` totals / `summaryWaste`.
 */
export function buildSummaryKineticWords(input: ProfileSummaryNarrativeInput): string[] {
  const area = purgeYourAreaCopy(resolveSummaryAreaLabel(input))
  const localityWord = formatSummaryLocalityKineticToken(area || 'the UK')
  const wasteCash = Math.max(0, Math.round(input.annualWasteCash))
  const wasteKg = Math.max(0, Math.round(input.annualWasteCarbon))
  const rawName = (input.displayName ?? '').trim().split(/\s+/)[0] ?? ''
  const greetName = rawName || 'there'
  const gbp = `£${wasteCash.toLocaleString('en-GB')}`
  const tCo2 = wasteKg / 1000
  const carbonAmount =
    tCo2 >= 1
      ? `${tCo2 >= 10 ? Math.round(tCo2) : Number(tCo2.toFixed(1))}t`
      : `${wasteKg}kg`

  const localityParts = localityWord.split(/\s+|\n/).filter(Boolean)

  return [
    'HELLO',
    greetName,
    'based',
    'on',
    'your',
    'profile',
    'people',
    'in',
    ...localityParts,
    'waste',
    gbp,
    'and',
    carbonAmount,
    'CO₂',
    'per',
    'year',
  ]
}

/**
 * Profile summary — **Mechanical Snap ticker** (`SummaryHeader` → `IntroWordCycle` with **`opacityTicker`**):
 * one word on screen at a time (opacity only — no per-word blur). Word list for cadence / locality wrapping.
 */
export function buildSummaryStaccatoWords(input: ProfileSummaryNarrativeInput): string[] {
  const area = purgeYourAreaCopy(resolveSummaryAreaLabel(input)).trim()
  const wasteCash = Math.max(0, Math.round(input.annualWasteCash))
  const wasteKg = Math.max(0, Math.round(input.annualWasteCarbon))
  const genomeMoney =
    input.genomeSavingsMoney != null && Number.isFinite(input.genomeSavingsMoney) && input.genomeSavingsMoney > 0
      ? Math.round(input.genomeSavingsMoney)
      : null
  const modelledMoney =
    input.totalsMoney > 0 ? Math.round(input.totalsMoney) : wasteCash
  const modelledCarbon =
    input.totalsCarbon > 0 ? Math.round(input.totalsCarbon) : wasteKg
  const cashForTicker = genomeMoney != null ? genomeMoney : modelledMoney
  const carbonForTicker = modelledCarbon
  const rawName = (input.displayName ?? '').trim().split(/\s+/)[0] ?? ''
  const greetName = rawName || 'there'
  const localityWord = formatSummaryLocalityKineticToken(area || 'the UK')

  const gbp =
    cashForTicker >= 1000
      ? `£${Math.round(cashForTicker / 1000)}k`
      : `£${cashForTicker.toLocaleString('en-GB')}`

  const tCo2 = carbonForTicker / 1000
  const carbonAmount =
    tCo2 >= 1
      ? `${tCo2 >= 10 ? Math.round(tCo2) : Number(tCo2.toFixed(1))}t`
      : `${carbonForTicker}kg`

  const out: string[] = []
  const pushWords = (phrase: string) => {
    const t = phrase.trim()
    if (!t) return
    if (t.includes('\n')) {
      for (const line of t.split('\n')) {
        for (const w of line.split(/\s+/).filter(Boolean)) out.push(w)
      }
      return
    }
    for (const w of t.split(/\s+/).filter(Boolean)) out.push(w)
  }

  out.push('hello')
  out.push(greetName)
  out.push('we', 'found', gbp)
  out.push('going', 'to', 'waste')
  out.push('in')
  out.push(localityWord)
  out.push('and', `${carbonAmount}`, 'co2.')
  return out
}

/** Final reveal block after Zip-Shutter (headline = Marvin, body = Roboto). */
export function buildSummaryRevealCopy(input: ProfileSummaryNarrativeInput): {
  headline: string
  body: string
} {
  const area = resolveSummaryAreaLabel(input)
  const { headline, body } = employmentWinFocus(input.employment_status, area)
  const waste = input.annualWasteCash
  const wasteKg = input.annualWasteCarbon
  const grid =
    input.local?.localCarbonG != null && Number.isFinite(input.local.localCarbonG)
      ? ` Grid ≈ ${Math.round(input.local.localCarbonG)} gCO₂/kWh.`
      : ''
  const tail = purgeYourAreaCopy(
    ` Typical slack in your bracket: £${waste.toLocaleString('en-GB')} / ${wasteKg} kg CO₂e/yr left on the table.${grid}`
  )
  return {
    headline,
    body: purgeYourAreaCopy(`${body}${tail}`),
  }
}
