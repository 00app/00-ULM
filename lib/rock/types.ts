import type { JourneyId } from '@/lib/journeys'
import type { UkSeason } from '@/lib/zone/seasonHint'

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
  /** When set, tip ranks higher in its UK season on Today's Tips — never hidden off-season. */
  seasons?: UkSeason[]
  /** Explicit save-type tag — which goal this tip serves. Falls back to money_gbp/carbon_kg > 0 inference when unset. */
  impact_tag?: 'money' | 'carbon' | 'both'
  /** Preferred time-of-day bucket for future rotation display grouping. */
  time_of_day?: 'morning' | 'afternoon' | 'evening'
  /**
   * Profile gate — when set, the tip only shows to users whose profile matches at least one value
   * in each supplied list. Omitting a key = no restriction on that dimension.
   * Values match the stored profile strings (HOME_TYPE, transport_baseline, power_type).
   */
  applicable?: {
    home_type?: string[]
    transport?: string[]
    power_type?: string[]
    /** OWNER/RENTER — same field the loft-insulation loop-question gate uses. */
    tenure?: string[]
  }
}
