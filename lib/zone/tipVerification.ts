/**
 * True Tip +1 verification — one high-leverage question per journey before deep scrape.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'

export type TipVerificationFollowUp = NonNullable<ZoneTipCard['followUp']>

const VERIFICATION_BY_JOURNEY: Partial<Record<JourneyId, TipVerificationFollowUp>> = {
  solar: {
    question: 'Do you have a south-facing roof?',
    options: ['YES', 'PARTLY', 'NO'],
    targetField: 'solar_roof_aspect',
  },
  home: {
    question: 'Is your loft insulated to 270mm?',
    options: ['YES', 'PARTLY', 'NO'],
    targetField: 'loft_insulation_depth',
  },
  grants: {
    question: 'Are you on any income-related benefits?',
    options: ['YES', 'NO', 'PREFER NOT'],
    targetField: 'income_benefits',
  },
  travel: {
    question: 'Could you switch one flight to rail this year?',
    options: ['YES', 'MAYBE', 'NO'],
    targetField: 'travel_rail_swap',
  },
  food: {
    question: 'Do you batch-cook to cut food waste?',
    options: ['YES', 'SOMETIMES', 'NO'],
    targetField: 'food_batch_cook',
  },
  money: {
    question: 'Are you on a smart or time-of-use tariff?',
    options: ['YES', 'NOT SURE', 'NO'],
    targetField: 'money_smart_tariff',
  },
  water: {
    question: 'Do you have a water meter?',
    options: ['YES', 'NO', 'NOT SURE'],
    targetField: 'water_meter',
  },
  waste: {
    question: 'Do you compost food scraps at home?',
    options: ['YES', 'SOMETIMES', 'NO'],
    targetField: 'waste_compost',
  },
  tech: {
    question: 'Do you leave devices on standby overnight?',
    options: ['YES', 'SOMETIMES', 'NO'],
    targetField: 'tech_standby',
  },
  holidays: {
    question: 'Could your next break stay in the UK?',
    options: ['YES', 'MAYBE', 'NO'],
    targetField: 'holidays_uk_break',
  },
  shopping: {
    question: 'Do you delay non-essential buys 48 hours?',
    options: ['YES', 'SOMETIMES', 'NO'],
    targetField: 'shopping_cool_off',
  },
  carbon: {
    question: 'Could you shift heavy use off-peak?',
    options: ['YES', 'MAYBE', 'NO'],
    targetField: 'carbon_off_peak',
  },
}

export function getTipVerificationFollowUp(
  journeyKey: JourneyId,
  existing?: TipVerificationFollowUp | null
): TipVerificationFollowUp | undefined {
  if (existing?.question?.trim() && (existing.options?.length ?? 0) > 0) {
    return existing
  }
  return VERIFICATION_BY_JOURNEY[journeyKey]
}

export function isTrueTipCardId(cardId: string): boolean {
  const id = cardId.trim().toLowerCase()
  return id.startsWith('tip-') || id.startsWith('inject-') || id.startsWith('rock-')
}
