/**
 * ZERO ZERO — SINGLE SOURCE OF TRUTH FOR USER IMPACT
 * 
 * This is the ONLY place where money and carbon are calculated.
 * UI components MUST read from this, never calculate.
 * 
 * Rules:
 * - Money and carbon are NEVER calculated in UI
 * - UI only reads: journey.summary, totals.money, totals.carbon
 * - All calculations use lib/brains/calculations.ts
 */

import { JourneyId, JOURNEY_ORDER } from '@/lib/journeys'
import {
  calculateHome,
  calculateTravel,
  calculateFood,
  calculateShopping,
  calculateMoney,
  calculateCarbon,
  calculateTech,
  calculateWaste,
  calculateHolidays,
  type ImpactResult,
} from './calculations'

export interface UserImpact {
  perJourneyResults: Record<JourneyId, ImpactResult>
  totals: {
    totalCarbon: number
    totalMoney: number
  }
}

export interface UserData {
  profile?: {
    name?: string
    postcode?: string
    household?: string
    home_type?: string
    transport_baseline?: string
  }
  journeyAnswers: Record<JourneyId, Record<string, string>>
}

/**
 * Build user impact from profile and journey answers.
 * 
 * This is the SINGLE SOURCE OF TRUTH for all impact calculations.
 * UI components read from this, never calculate directly.
 */
export function buildUserImpact(user: UserData): UserImpact {
  const perJourneyResults: Record<JourneyId, ImpactResult> = {} as Record<
    JourneyId,
    ImpactResult
  >
  let totalCarbon = 0
  let totalMoney = 0

  // Calculate impact for each journey
  JOURNEY_ORDER.forEach((journeyKey) => {
    const answers = user.journeyAnswers[journeyKey] || {}
    const impact = calculateJourneyImpact(journeyKey, answers)
    perJourneyResults[journeyKey] = impact
    totalCarbon += impact.carbonKg
    totalMoney += impact.moneyGbp
  })

  return {
    perJourneyResults,
    totals: {
      totalCarbon: Math.round(totalCarbon),
      totalMoney: Math.round(totalMoney),
    },
  }
}

/**
 * Calculate impact for a single journey.
 * Internal helper - use buildUserImpact for all calculations.
 */
function calculateJourneyImpact(
  journeyKey: JourneyId,
  answers: Record<string, string> | undefined
): ImpactResult {
  if (!answers || Object.keys(answers).length === 0) {
    return {
      carbonKg: 0,
      moneyGbp: 0,
      source: 'uk government data',
      explanation: ['Answer a few questions to see your personalised impact.'],
    }
  }

  switch (journeyKey) {
    case 'home':
      return calculateHome(answers)
    case 'travel':
      return calculateTravel(answers)
    case 'food':
      return calculateFood(answers)
    case 'shopping':
      return calculateShopping(answers)
    case 'money':
      return calculateMoney(answers)
    case 'carbon':
      return calculateCarbon(answers)
    case 'tech':
      return calculateTech(answers)
    case 'waste':
      return calculateWaste(answers)
    case 'holidays':
      return calculateHolidays(answers)
    default:
      return {
        carbonKg: 0,
        moneyGbp: 0,
        source: 'uk government data',
        explanation: ['Complete this journey to see your impact.'],
      }
  }
}

/**
 * Get impact for a single journey (for journey summary).
 * Reads from buildUserImpact - never calculates directly.
 */
export function getJourneyImpact(
  journeyKey: JourneyId,
  answers: Record<string, string> | undefined
): ImpactResult {
  return calculateJourneyImpact(journeyKey, answers)
}
