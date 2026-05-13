/**
 * Profile summary — dynamic copy from employment, postcode, and local grid (council + carbon intensity).
 * Client supplies data from /api/local-intelligence (server uses getLocalData).
 *
 * ## Kinetic £ / CO₂ (same “cord” as Zone cards)
 * `app/profile/summary` loads all `journey_*_answers` from localStorage and the same profile fields as Zone,
 * then runs **`buildUserImpact({ profile, journeyAnswers })`** (`lib/brains/buildUserImpact.ts`).
 * - **Spend anchor:** `max(BASELINE_2026_CAP_GBP, impact.totals.totalMoney)` — not below the 2026 cap baseline.
 * - **“Waste” slack shown in the pulse:** `round(spendAnchor × WASTE_FACTOR)` for £ and `round(impact.totals.totalCarbon × WASTE_FACTOR)` for kg CO₂e/yr (`WASTE_FACTOR = 0.22` on the summary page). Same framing as “typical slack left on the table” in **`buildSummaryRevealCopy`**.
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
  const fromLocal = li ? formatLocationDisplayName(li, null).trim() : ''
  const rawCouncilLabel = (input.councilLabel || '').trim()
  const cleanedCouncilLabel = removePostcodeTokens(rawCouncilLabel)
  const fromCouncilLabel =
    looksLikeUkPostcode(cleanedCouncilLabel) || cleanedCouncilLabel.length === 0
      ? ''
      : cleanedCouncilLabel
  const area = fromLocal || fromCouncilLabel || 'the UK'
  return purgeYourAreaCopy(area)
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
    case 'SELF_EMPLOYED':
      return {
        kineticTag: 'TAX-WINS',
        headline: 'Your books change the physics.',
        body:
          'Self-employed: we’re prioritising tax-efficient upgrades and home-office splits — capital allowances on kit, heating apportionment, and green kit that pays back through deductions. Your grid and postcode are locked in for 2026 UK rates.',
      }
    case 'EMPLOYED':
      return {
        kineticTag: 'BENEFITS',
        headline: 'Salary sacrifice beats list price.',
        body: `Employed: salary-sacrifice EVs and cycle schemes often beat cash purchases; workplace pension and perks stack with commute and travel wins. ${gridMatchPhrase(areaDisplay)}`,
      }
    case 'UNEMPLOYED':
      return {
        kineticTag: 'HABITS',
        headline: 'Zero-upfront wins first.',
        body:
          'We’re weighting low-barrier habits — cooler washes, phantom load, radiator tweaks — and hardship-capable routes. Local grid data still shapes what’s worth doing where you live.',
      }
    default:
      return {
        kineticTag: 'WINS',
        headline: 'Your numbers are live.',
        body: `We’ve run your profile against 2026 UK defaults and ${areaDisplay === 'the UK' ? 'UK-wide' : areaDisplay} signals. Employment status fine-tunes whether we lead with tax, benefits, or habits — add it in profile anytime.`,
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
 * On-screen sequence: **HELLO → first name → locality** (long tokens scaled / wrapped — Littlehampton fix) →
 * bridge phrase → waste → £… → and → …kg CO₂e (one beat) → per → year.
 * £ / CO₂: see file header — `buildUserImpact` × `WASTE_FACTOR`.
 */
export function buildSummaryKineticWords(input: ProfileSummaryNarrativeInput): string[] {
  const area = purgeYourAreaCopy(resolveSummaryAreaLabel(input))
  const localityWord = formatSummaryLocalityKineticToken(area || 'the UK')
  const wasteCash = Math.max(0, Math.round(input.annualWasteCash))
  const wasteKg = Math.max(0, Math.round(input.annualWasteCarbon))
  const rawName = (input.displayName ?? '').trim().split(/\s+/)[0] ?? ''
  const greetName = rawName || 'there'
  const gbp = `£${wasteCash.toLocaleString('en-GB')}`

  return [
    'HELLO',
    greetName,
    localityWord,
    'based on your profile',
    'waste',
    gbp,
    'and',
    `${wasteKg}kg CO₂e`,
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
  const rawName = (input.displayName ?? '').trim().split(/\s+/)[0] ?? ''
  const greetName = rawName || 'there'

  const out: string[] = ['Hello', greetName, 'Based', 'on', 'your', 'profile', 'people', 'in']

  if (area && area !== 'the UK') {
    out.push(...area.split(/\s+/).filter(Boolean))
  } else {
    out.push('the', 'UK')
  }

  out.push('waste')

  const gbp =
    wasteCash >= 1000
      ? `£${Math.round(wasteCash / 1000)}k`
      : `£${wasteCash.toLocaleString('en-GB')}`
  out.push(gbp, 'and')

  const tCo2 = wasteKg / 1000
  const carbonStr =
    tCo2 >= 1
      ? `${tCo2 >= 10 ? Math.round(tCo2) : Number(tCo2.toFixed(1))}t CO2`
      : `${wasteKg}kg CO2e`
  out.push(carbonStr, 'per', 'year.')

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
