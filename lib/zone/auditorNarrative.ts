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
    travel: 'travel',
    food: 'food',
    shopping: 'shopping',
    money: 'household spending',
    carbon: 'grid and usage',
    waste: 'waste',
    holidays: 'holiday travel',
  }
  return m[journey] ?? 'household'
}

function proofSentence(journey: JourneyId, sourceName: string, postcode?: string): string {
  const london = isLondonPostcode(postcode)
  if (journey === 'tech') {
    return `${sourceName} reckon standby creep is up about 8% in this April 2026 climate — dull, but very fixable with a few plug changes.`
  }
  if (journey === 'home') {
    return `${sourceName} still put heating and background draw at the top of the bill pile — the April 2026 cap sits around £${PRICE_CAP_APRIL_2026.toLocaleString('en-GB')}, so fabric and tariff moves still matter.`
  }
  if (journey === 'travel') {
    if (london) {
      return `${sourceName} flag ULEZ and duty as keeping London commute costs stubborn through April 2026 — worth planning swaps before you renew anything.`
    }
    return `${sourceName} show fuel and fares still running hot in the April 2026 economy — small commute shifts add up faster than another loyalty card.`
  }
  return `${sourceName} point to policy and tariff pressure through April 2026 — this category stays expensive until you make one verified move.`
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
