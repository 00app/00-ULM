/**
 * True Tip narrative — three paragraphs (discovery → money/carbon → action) without UI labels.
 */

import type { JourneyId } from '@/lib/journeys'
import { PRICE_CAP_APRIL_2026 } from '@/lib/brains/constants'
import { isLondonPostcode } from '@/lib/zone/verifiedRevenue'
import { formatMoneyValue } from '@/lib/format'

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
    return `According to ${sourceName}, standby waste has increased by 8% under the April 2026 energy climate.`
  }
  if (journey === 'home') {
    return `According to ${sourceName}, heating and passive draw remain the dominant bill drain under the April 2026 price cap at £${PRICE_CAP_APRIL_2026.toLocaleString('en-GB')}.`
  }
  if (journey === 'travel') {
    if (london) {
      return `According to ${sourceName}, ULEZ and duty pressure keep London commuter costs elevated through April 2026.`
    }
    return `According to ${sourceName}, fuel and fare pressure remains elevated under the April 2026 economy.`
  }
  return `According to ${sourceName}, policy and tariff pressure in April 2026 keeps this category expensive without a verified move.`
}

export function bridgeSentence(journey: JourneyId): string {
  if (journey === 'tech') {
    return `Use the link below to swap to a verified standby cut-down and reclaim this cash today.`
  }
  if (journey === 'home') {
    return `Use the link below to lock a verified tariff or grant step and reclaim this cash today.`
  }
  return `Use the link below to execute the verified offer and reclaim this cash today.`
}

export function buildAuditorDetectionParagraph(
  userPostcode: string,
  moneyGbp: number,
  journey: JourneyId
): string {
  const pc = userPostcode.trim() || 'your postcode'
  const moneyCompact = formatMoneyValue(Math.max(0, Math.round(moneyGbp)))
  const topic = auditTopicPhrase(journey)
  return `Our audit of ${pc} reveals a £${moneyCompact} annual drain on your ${topic} setup.`
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
  const detection = buildAuditorDetectionParagraph(params.userPostcode, params.moneyGbp, params.journey)
  const proof = proofSentence(params.journey, sourceName, params.userPostcode)
  const bridge = bridgeSentence(params.journey)
  return [detection, proof, bridge]
}
