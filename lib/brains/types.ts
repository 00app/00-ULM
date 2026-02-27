/**
 * Zero Zero — Persona-based buildUserImpact types
 * Single source of truth for impact calculation inputs and outputs.
 */

import type { JourneyId } from '@/lib/journeys'

/** Age persona for tips: Junior (tech, food) | Adult (MID) | Retired (home, holidays) */
export type Persona = 'JUNIOR' | 'MID' | 'RETIRED'

/** Profile shape used by buildUserImpact and buildZoneViewModel */
export interface ImpactProfile {
  name?: string
  postcode?: string
  household?: string
  home_type?: string
  transport_baseline?: string
  /** Persona for tips; optional. MID = Adult. */
  age?: Persona
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
