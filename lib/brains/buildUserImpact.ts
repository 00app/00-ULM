/**
 * ZERO ZERO — SINGLE SOURCE OF TRUTH FOR USER IMPACT
 *
 * This is the ONLY place where money and carbon are calculated.
 * UI components MUST read from this, never calculate.
 *
 * Rules:
 * - Money and carbon are NEVER calculated in UI
 * - All calculations use lib/brains/calculations.ts (annualized: monthly × 12 where applicable)
 * - Persona (profile.age) is used by buildZoneViewModel for tips, not here
 * - S UPDATE: Optional scraped data is applied via applyScrapedOverlay (≤20% delta).
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
  calculateGeneralHomeLiving,
  calculateGeneralTransport,
  calculateGeneralHomeExtra,
  type ImpactResult,
} from './calculations'
import { applyScrapedOverlay, type ScrapedOverlayResult } from './scrapedOverlay'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'
import type { Persona, ImpactProfile, UserData } from './types'

export type { Persona, ImpactProfile, UserData } from './types'
export type { ScrapedOverlayResult } from './scrapedOverlay'

export interface UserImpact {
  /** Per-journey results; may include insightLabel/insightAlert when scraped data applied */
  perJourneyResults: Record<JourneyId, ScrapedOverlayResult>
  /** Three general cards for Zone "act now." based on profile (household, home_type, transport_baseline). */
  generalCards: [ImpactResult, ImpactResult, ImpactResult]
  totals: {
    totalCarbon: number
    totalMoney: number
  }
}

export interface BuildUserImpactOptions {
  /** S UPDATE: scraped data from 001 Scraper (e.g. from scraped_summary table). Partial = only some journeys may have data. */
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
}

/**
 * Build user impact from profile and journey answers.
 * Single source of truth; all values annualized (e.g. monthly_cost × 12 in calculations).
 * S UPDATE: Pass options.scraped to blend in 001 Scraper data (≤20% delta); sets insightLabel/insightAlert for UI.
 */
export function buildUserImpact(user: UserData, options?: BuildUserImpactOptions): UserImpact {
  const perJourneyResults: Record<JourneyId, ScrapedOverlayResult> = {} as Record<
    JourneyId,
    ScrapedOverlayResult
  >
  let totalCarbon = 0
  let totalMoney = 0
  const scraped = options?.scraped

  // Calculate impact for each journey; apply scraped overlay when available
  JOURNEY_ORDER.forEach((journeyKey) => {
    const answers = user.journeyAnswers[journeyKey] || {}
    const base = calculateJourneyImpact(journeyKey, answers)
    const result = applyScrapedOverlay(base, scraped?.[journeyKey], journeyKey)
    perJourneyResults[journeyKey] = result
    totalCarbon += result.carbonKg
    totalMoney += result.moneyGbp
  })

  // General cards for Zone "act now." — based on profile only (Single Source of Truth)
  const profile = user.profile
  const generalCards: [ImpactResult, ImpactResult, ImpactResult] = [
    calculateGeneralHomeLiving(profile),
    calculateGeneralTransport(profile),
    calculateGeneralHomeExtra(profile),
  ]

  return {
    perJourneyResults,
    generalCards,
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
