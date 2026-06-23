/**
 * Map property_intelligence → journey answer pre-fills (signup / hydration).
 * Only injects when confidence is ADDRESS_MATCHED or POSTCODE_ONLY with strong EPC match.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { mapEpcToJourneyAnswerHints } from '@/lib/epc/mapEpcToProfileHints'
import type {
  PropertyAnswerSourcesMap,
  PropertyIntelligence,
  PropertyIntelligenceConfidence,
} from '@/lib/intelligence/propertyIntelligenceTypes'

export type PropertyPrefillAnswers = Partial<Record<JourneyId, Record<string, string>>>

export type PropertyPrefillResult = {
  answers: PropertyPrefillAnswers
  sources: PropertyAnswerSourcesMap
  /** Profile-level home_power when EPC fuel maps cleanly. */
  home_power?: string
}

const MIN_CONFIDENCE: PropertyIntelligenceConfidence[] = ['ADDRESS_MATCHED', 'POSTCODE_ONLY']

function canInject(confidence: PropertyIntelligenceConfidence): boolean {
  return MIN_CONFIDENCE.includes(confidence)
}

function mergeAnswers(
  target: PropertyPrefillAnswers,
  journeyId: JourneyId,
  patch: Record<string, string>,
  source: 'epc' | 'land_registry',
  sources: PropertyAnswerSourcesMap
): void {
  if (Object.keys(patch).length === 0) return
  const existing = target[journeyId] ?? {}
  const journeySources = sources[journeyId] ?? {}
  for (const [key, value] of Object.entries(patch)) {
    if (existing[key]) continue
    existing[key] = value
    journeySources[key] = source
  }
  target[journeyId] = existing
  sources[journeyId] = journeySources
}

/**
 * Build partial journey answers from property intelligence.
 * Does not overwrite existing answers — pass `existingAnswers` from DB/localStorage.
 */
export function buildPropertyAnswerPrefill(
  propertyIntelligence: PropertyIntelligence | null | undefined,
  existingAnswers?: Partial<Record<JourneyId, Record<string, string>>>
): PropertyPrefillResult {
  const empty: PropertyPrefillResult = { answers: {}, sources: {} }
  if (!propertyIntelligence?.confidence || !canInject(propertyIntelligence.confidence)) {
    return empty
  }

  const answers: PropertyPrefillAnswers = {}
  const sources: PropertyAnswerSourcesMap = {}
  const existing = existingAnswers ?? {}

  if (propertyIntelligence.epc?.found) {
    const hints = mapEpcToJourneyAnswerHints(propertyIntelligence.epc)
    if (hints.home) {
      mergeAnswers(answers, 'home', hints.home as Record<string, string>, 'epc', sources)
    }
    if (hints.utilities) {
      mergeAnswers(answers, 'utilities', hints.utilities as Record<string, string>, 'epc', sources)
    }
    if (hints.money) {
      const moneyPatch: Record<string, string> = {}
      if (hints.money.monthly_energy_bill != null) {
        moneyPatch.monthly_energy_bill = String(hints.money.monthly_energy_bill)
      }
      mergeAnswers(answers, 'money', moneyPatch, 'epc', sources)
    }
  }

  const lr = propertyIntelligence.landRegistry
  if (lr?.found && lr.propertyType && !existing.home?.property_type) {
    mergeAnswers(
      answers,
      'home',
      { property_type: lr.propertyType },
      'land_registry',
      sources
    )
  }

  // Strip keys that already exist in user answers
  for (const jid of JOURNEY_ORDER) {
    const prefilled = answers[jid]
    const prior = existing[jid]
    if (!prefilled || !prior) continue
    for (const key of Object.keys(prefilled)) {
      if (prior[key]) {
        delete prefilled[key]
        delete sources[jid]?.[key]
      }
    }
    if (Object.keys(prefilled).length === 0) delete answers[jid]
  }

  const epcHints = propertyIntelligence.epc?.found
    ? mapEpcToJourneyAnswerHints(propertyIntelligence.epc)
    : null

  return {
    answers,
    sources,
    home_power: epcHints?.home_power,
  }
}

export function attributionLabelForSource(source?: string): string | null {
  switch (source) {
    case 'epc':
      return 'from your EPC record'
    case 'land_registry':
      return 'from Land Registry'
    case 'property_data':
      return 'from property data'
    default:
      return null
  }
}
