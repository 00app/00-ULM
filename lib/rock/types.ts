import type { JourneyId } from '@/lib/journeys'

export interface RockHabit {
  slug: string
  journey_key: JourneyId
  title: string
  insight: string
  money_gbp: number
  carbon_kg: number
  provider_name: string
  /** Optional primary https link for Solo Focus / diagnostics; else `trustedUrlForJourney(journey_key)`. */
  learn_url?: string
}
