/**
 * True Tip narrative — three paragraphs (discovery → money/carbon → action) without UI labels.
 */

import type { JourneyId } from '@/lib/journeys'
import { PRICE_CAP_APRIL_2026 } from '@/lib/brains/constants'
import { resolveSoloFocusPlaceLabel } from '@/lib/zone/localityCopy'
import { isLondonPostcode } from '@/lib/zone/verifiedRevenue'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'

function auditTopicPhrase(journey: JourneyId): string {
  const m: Partial<Record<JourneyId, string>> = {
    tech: 'tech',
    home: 'home energy',
    utilities: 'gas and electricity',
    grants: 'grants and upgrades',
    solar: 'solar',
    travel: 'travel',
    food: 'food',
    shopping: 'shopping',
    money: 'household spending',
    carbon: 'carbon',
    waste: 'waste',
    water: 'water',
    holidays: 'holiday travel',
  }
  return m[journey] ?? 'household'
}

/** Shared mechanical fallback — must never surface in Solo Focus (journey-specific proof replaces it). */
export function isGenericAuditorProofParagraph(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  return (
    /point to policy and tariff pressure through april 2026/i.test(t) &&
    /stays expensive until you make one verified move/i.test(t)
  )
}

function proofSentence(journey: JourneyId, sourceName: string, postcode?: string): string {
  const london = isLondonPostcode(postcode)
  const cap = PRICE_CAP_APRIL_2026.toLocaleString('en-GB')
  switch (journey) {
    case 'tech':
      return `${sourceName} reckon standby creep is up about 8% in this April 2026 climate — dull, but very fixable with a few plug changes.`
    case 'home':
      return `${sourceName} still put heating and background draw at the top of the bill pile — the April 2026 cap sits around £${cap}, so fabric and tariff moves still matter.`
    case 'travel':
      if (london) {
        return `${sourceName} flag ULEZ and duty as keeping London commute costs stubborn through April 2026 — worth planning swaps before you renew anything.`
      }
      return `${sourceName} show fuel and fares still running hot in the April 2026 economy — small commute shifts add up faster than another loyalty card.`
    case 'utilities':
      return `${sourceName} tie unit rates and standing charges to the April 2026 cap near £${cap} — the tariff you are on still sets the ceiling on every kWh.`
    case 'grants':
      return `${sourceName} list upgrade grants with fixed caps and installer rules — the £ figure only holds once eligibility and quotes match your home.`
    case 'solar':
      return `${sourceName} size payback from export rates and daylight at your roof pitch — generic kit quotes rarely match how you actually use power.`
    case 'food':
      return `${sourceName} put food waste and packaging near the top of kitchen-table spend — meal planning beats another delivery subscription.`
    case 'shopping':
      return `${sourceName} show repair-first and longer-life goods beating impulse replacements — one durable buy often beats three cheap ones.`
    case 'money':
      return `${sourceName} track idle cash and bill drift as the quiet leaks — small account and tariff moves compound faster than a new card.`
    case 'carbon':
      return `${sourceName} map grid intensity and home demand together — one habit change often moves kg faster than offsetting alone.`
    case 'waste':
      return `${sourceName} price landfill and recycling separately — sorting and composting at home still beats paying for extra bin lifts.`
    case 'water':
      return `${sourceName} link metered water and sewage rises — fixing drips and fitting aerators often beats arguing over the standing charge.`
    case 'holidays':
      return `${sourceName} show short-haul rail beating domestic flights on cost and carbon — booking early still matters in the April 2026 market.`
    default:
      return `${sourceName} anchor this row to your saved answers and the April 2026 cap near £${cap} — verify the offer before you commit.`
  }
}

/** @deprecated Solo Focus no longer surfaces CTA-bridge filler — use {@link payoffSentence}. */
export function bridgeSentence(journey: JourneyId): string {
  if (journey === 'grants') {
    return `Apply through the CTA — confirm MCS installer quotes and eligibility before you commit.`
  }
  if (journey === 'tech') {
    return `Cut standby draw via the CTA — swap plugs and timers, then record the kWh drop against your audit.`
  }
  if (journey === 'home') {
    return `Lock fabric or tariff moves via the CTA — align quotes to your postcode audit before you switch.`
  }
  return `Execute the verified step in the CTA and record the £ and CO₂e against your audit trail.`
}

/** Third True Tip beat — hands off to the stamped £ / CO₂e row (not “open the CTA”). */
export function payoffSentence(journey: JourneyId, moneyGbp: number, carbonKg: number): string {
  const m = Math.max(0, Math.round(moneyGbp))
  const c = Math.max(0, Math.round(carbonKg))
  const topic = auditTopicPhrase(journey)
  return `We've put about £${formatMoneyValue(m)} a year and around ${formatCarbonValue(c)} CO₂e against your ${topic} row — from your saved audit, not a guess.`
}

export function buildAuditorDetectionParagraph(params: {
  placeLabel: string
  moneyGbp: number
  journey: JourneyId
}): string {
  const place = params.placeLabel.trim() || 'your area'
  const moneyCompact = formatMoneyValue(Math.max(0, Math.round(params.moneyGbp)))
  const topic = auditTopicPhrase(params.journey)
  const opener =
    place === 'your area'
      ? `In your area, about £${moneyCompact} a year can quietly slip away on ${topic}`
      : `In ${place}, about £${moneyCompact} a year can quietly slip away on ${topic}`
  return `${opener} — not to scare you, just to show where a proper fix pays back.`
}

export function buildAuditorNarrativeParagraphs(params: {
  userPostcode: string
  sourceName: string
  journey: JourneyId
  moneyGbp: number
  carbonKg: number
  locality: string
}): string[] {
  const sourceName = params.sourceName.trim() || 'UK Government'
  const placeLabel = resolveSoloFocusPlaceLabel({
    locality: params.locality,
    postcode: params.userPostcode,
  })
  const detection = buildAuditorDetectionParagraph({
    placeLabel,
    moneyGbp: params.moneyGbp,
    journey: params.journey,
  })
  const proof = proofSentence(params.journey, sourceName, params.userPostcode)
  const payoff = payoffSentence(params.journey, params.moneyGbp, params.carbonKg)
  return [detection, proof, payoff]
}
