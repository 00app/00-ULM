/**
 * Honest empty-state baselines — **no fabricated £/kg on the Zone wall**.
 * Real figures come only from `research_results`, `scraped_summary`, or scrape-sync stream.
 */

import type { JourneyId } from '@/lib/journeys'

export interface JourneyMoneyLead {
  journey_key: JourneyId
  money_lead: string
  money_value: number
  carbon_backup: string
  carbon_value: number
  crawler_tip?: string
  agent_focus?: string
}

const COMPUTING = 'Computing...'

function emptyLead(journey_key: JourneyId): JourneyMoneyLead {
  return {
    journey_key,
    money_lead: COMPUTING,
    money_value: 0, // intentionally zero — no marketing £ from defaults; Neon stream only
    carbon_backup: COMPUTING,
    carbon_value: 0, // intentionally zero — no fabricated kg from defaults
    crawler_tip: COMPUTING,
    agent_focus: COMPUTING,
  }
}

/** Shape-only defaults (all zero) — used when scrape-sync has no DB rows yet. */
export const UK_2026_MONEY_LEAD: Record<JourneyId, JourneyMoneyLead> = {
  home: emptyLead('home'),
  utilities: emptyLead('utilities'),
  solar: emptyLead('solar'),
  travel: emptyLead('travel'),
  holidays: emptyLead('holidays'),
  food: emptyLead('food'),
  shopping: emptyLead('shopping'),
  money: emptyLead('money'),
  carbon: emptyLead('carbon'),
  tech: emptyLead('tech'),
  water: emptyLead('water'),
  waste: emptyLead('waste'),
}
