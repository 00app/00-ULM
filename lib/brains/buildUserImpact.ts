/**
 * ZERO ZERO — SINGLE SOURCE OF TRUTH FOR USER IMPACT
 *
 * This is the ONLY place where money and carbon are calculated.
 * UI components MUST read from this, never calculate.
 *
 * Rules:
 * - Money and carbon are NEVER calculated in UI
 * - All calculations use lib/brains/calculations.ts (annualized: monthly × 12 where applicable)
 * - Electricity → carbon uses **TRUTH_2026_MARCH.GRID_INTENSITY** (129 g/kWh) as **0.129 kg CO₂e/kWh**
 *   via `MARCH_2026_ECONOMY.CARBON_FACTOR_ELEC` inside `lib/carbonCashCalculator` FACTORS_2026.
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
  calculateGrants,
  calculateSolar,
  calculateWater,
  calculateGeneralHomeLiving,
  calculateGeneralTransport,
  calculateGeneralHomeExtra,
  applyEmploymentFinancialPhysics,
  normalizeEmploymentStatus,
  type ImpactResult,
} from './calculations'
import { applyScrapedOverlay, type ScrapedOverlayResult } from './scrapedOverlay'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import type { Persona, ImpactProfile, UserData, EmploymentStatus } from './types'

export type { Persona, ImpactProfile, UserData } from './types'
export type { ScrapedOverlayResult } from './scrapedOverlay'

/** Personal Summary: "waste" vs optimized 00-Spec home — March 2026 baseline, seed logic */
export interface SummaryWaste {
  annualWasteCash: number
  annualWasteCarbon: number
}

export interface UserImpact {
  /** Per-journey results; may include insightLabel/insightAlert when scraped data applied */
  perJourneyResults: Record<JourneyId, ScrapedOverlayResult>
  /** Three general cards for Zone "act now." based on profile (household, home_type, transport_baseline). */
  generalCards: [ImpactResult, ImpactResult, ImpactResult]
  totals: {
    totalCarbon: number
    totalMoney: number
  }
  /** Personal Summary H2: extra impact vs optimized 00-Spec home (seed: HOUSE, CAR, FAMILY) */
  summaryWaste: SummaryWaste
}

export interface BuildUserImpactOptions {
  /** S UPDATE: scraped data from 001 Scraper (e.g. from scraped_summary table). Partial = only some journeys may have data. */
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
  /** Live £/kWh from `research_results` (Neon) — applied to home journey only. */
  homeUnitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
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
  const profile = user.profile
  const employment = normalizeEmploymentStatus(profile?.employment_status)

  // Calculate impact for each journey; apply scraped overlay when available
  JOURNEY_ORDER.forEach((journeyKey) => {
    const answers = user.journeyAnswers[journeyKey] || {}
    const homeRates = journeyKey === 'home' ? options?.homeUnitRates : undefined
    const base = calculateJourneyImpact(journeyKey, answers, profile, homeRates)
    let result = applyScrapedOverlay(base, scraped?.[journeyKey], journeyKey)
    // Live amounts: use UK 2026 defaults when values are missing so cards always show real money + carbon
    const def = UK_2026_MONEY_LEAD[journeyKey]
    if (def) {
      if (result.carbonKg === 0 && result.moneyGbp === 0) {
        result = {
          ...result,
          carbonKg: def.carbon_value,
          moneyGbp: def.money_value,
          explanation: result.explanation?.length ? result.explanation : [def.carbon_backup || 'UK average — answer a question to personalise.'],
        }
      } else if (result.carbonKg === 0) {
        result = { ...result, carbonKg: def.carbon_value }
      } else if (result.moneyGbp === 0) {
        result = { ...result, moneyGbp: def.money_value }
      }
    }
    result = applyEmploymentFinancialPhysics(result, employment, journeyKey)
    perJourneyResults[journeyKey] = result
    totalCarbon += result.carbonKg
    totalMoney += result.moneyGbp
  })

  // General cards for Zone "act now." — based on profile only (Single Source of Truth)
  const generalCards: [ImpactResult, ImpactResult, ImpactResult] = [
    applyEmploymentFinancialPhysics(calculateGeneralHomeLiving(profile), employment, 'home'),
    applyEmploymentFinancialPhysics(calculateGeneralTransport(profile), employment, 'travel'),
    applyEmploymentFinancialPhysics(calculateGeneralHomeExtra(profile), employment, 'home'),
  ]

  const summaryWaste = getSummaryWaste(profile, employment)

  return {
    perJourneyResults,
    generalCards,
    totals: {
      totalCarbon: Math.round(totalCarbon),
      totalMoney: Math.round(totalMoney),
    },
    summaryWaste,
  }
}

/**
 * Personal Summary "waste" figure: extra impact vs optimized 00-Spec home.
 * March 2026 baseline (Elec 27.7p, Gas 5.9p). Seed logic: HOUSE +25% vs FLAT; CAR +£1,200 and +1,800 kg; FAMILY scale energy by 1.4.
 */
export function getSummaryWaste(profile?: ImpactProfile, employment?: EmploymentStatus): SummaryWaste {
  const baselineEnergyCash = 600
  const baselineEnergyCarbon = 1500
  let energyCash = baselineEnergyCash
  let energyCarbon = baselineEnergyCarbon

  if (profile?.home_type === 'HOUSE') {
    energyCash *= 1.25
    energyCarbon *= 1.25
  }
  if (profile?.household === 'FAMILY') {
    energyCash *= 1.4
    energyCarbon *= 1.4
  }

  const carCash = profile?.transport_baseline === 'CAR' ? 1200 : 0
  const carCarbon = profile?.transport_baseline === 'CAR' ? 1800 : 0

  let wasteCash = energyCash + carCash
  let wasteCarbon = energyCarbon + carCarbon
  if (employment === 'UNEMPLOYED') {
    wasteCash *= 0.96
    wasteCarbon *= 0.97
  } else if (employment === 'SELF_EMPLOYED') {
    wasteCash *= 1.02
  }

  return {
    annualWasteCash: Math.round(wasteCash),
    annualWasteCarbon: Math.round(wasteCarbon),
  }
}

/**
 * Calculate impact for a single journey.
 * Internal helper - use buildUserImpact for all calculations.
 */
function calculateJourneyImpact(
  journeyKey: JourneyId,
  answers: Record<string, string> | undefined,
  profile?: ImpactProfile,
  homeUnitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
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
      return calculateHome(answers, homeUnitRates)
    case 'grants':
      return calculateGrants(answers)
    case 'solar':
      return calculateSolar(answers)
    case 'travel':
      return calculateTravel(answers, profile?.transport_baseline)
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
    case 'water':
      return calculateWater(answers)
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
  answers: Record<string, string> | undefined,
  profile?: ImpactProfile
): ImpactResult {
  const raw = calculateJourneyImpact(journeyKey, answers, profile)
  return applyEmploymentFinancialPhysics(
    raw,
    normalizeEmploymentStatus(profile?.employment_status),
    journeyKey
  )
}
