/**
 * Zero Zero — Persona-based buildUserImpact types
 * Single source of truth for impact calculation inputs and outputs.
 */

import type { JourneyId } from '@/lib/journeys'

/** Life-stage persona for tips: starting out | mid-life | retired */
export type Persona = 'JUNIOR' | 'MID' | 'RETIRED'

/** Student | employed | between jobs — master switch for grants vs benefits lane */
export type EmploymentStatus = 'STUDENT' | 'EMPLOYED' | 'BETWEEN_JOBS'

/** Profile shape used by buildUserImpact and buildZoneViewModel */
export interface ImpactProfile {
  name?: string
  postcode?: string
  household?: string
  home_type?: string
  /** GAS | ELECTRIC | MIX — unlocks utilities lane + synthetic estimates. */
  home_power?: string
  transport_baseline?: string
  /** Persona for tips; optional. MID = Adult. */
  age?: Persona
  /** Lifestyle Architect: shifts £ emphasis and explanation lines (not grant-only). */
  employment_status?: EmploymentStatus
  /** Bath/shower/both onboarding answer — feeds calculateWater's wash_preference branch. */
  wash_preference?: string
  /** none/one_two/three_plus flights a year — feeds calculateHolidays' annual_flights branch. */
  flight_frequency?: string
}

/** Input to buildUserImpact — profile + all journey answers */
export interface UserData {
  profile?: ImpactProfile
  journeyAnswers: Record<JourneyId, Record<string, string>>
}

/** Output of buildUserImpact — only place calculations are performed. ImpactResult from calculations.ts. */
export interface UserImpact {
  perJourneyResults: Record<JourneyId, import('./calculations').ImpactResult>
  generalCards: [import('./calculations').ImpactResult, import('./calculations').ImpactResult, import('./calculations').ImpactResult]
  totals: {
    totalCarbon: number
    totalMoney: number
  }
}

/** Options for tips selection (used by buildZoneViewModel, not buildUserImpact) */
export interface TipsPersonaOptions {
  /** Bias tips toward these journeys when persona is JUNIOR */
  juniorJourneys: JourneyId[]
  /** Bias tips toward these journeys when persona is RETIRED */
  retiredJourneys: JourneyId[]
}

export const DEFAULT_TIPS_PERSONA: TipsPersonaOptions = {
  juniorJourneys: ['tech', 'food'],
  retiredJourneys: ['home', 'holidays'],
}
