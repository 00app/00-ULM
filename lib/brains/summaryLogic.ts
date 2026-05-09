/**
 * Profile summary — dynamic copy from employment, postcode, and local grid (council + carbon intensity).
 * Client supplies data from /api/local-intelligence (server uses getLocalData).
 */

import type { EmploymentStatus } from './types'
import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName, locationInPhrase } from '@/lib/locationIdentity'

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
 * Profile summary — one word at a time only (no paragraphs; 450ms + AnimatePresence).
 * Exact sequence: based, on, your, profile, people, in, [Area], waste, around, £[Value], and, [Value]kg, carbon, per, year
 */
export function buildSummaryKineticWords(input: ProfileSummaryNarrativeInput): string[] {
  const area = purgeYourAreaCopy(resolveSummaryAreaLabel(input))
  const localityWord = purgeYourAreaCopy(area || 'the UK')
  const wasteCash = Math.max(0, Math.round(input.annualWasteCash))
  const wasteKg = Math.max(0, Math.round(input.annualWasteCarbon))

  return [
    'based',
    'on',
    'your',
    'profile',
    'people',
    'in',
    localityWord,
    'waste',
    'around',
    `£${wasteCash.toLocaleString('en-GB')}`,
    'and',
    `${wasteKg}kg`,
    'carbon',
    'per',
    'year',
  ]
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
    ` Typical slack in your bracket: ~£${waste.toLocaleString('en-GB')} / ~${wasteKg} kg CO₂e/yr left on the table.${grid}`
  )
  return {
    headline,
    body: purgeYourAreaCopy(`${body}${tail}`),
  }
}
