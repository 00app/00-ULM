/**
 * UK journey baselines — **numeric + short display labels only**.
 * Narrative tips and agent copy come from Firecrawl / `scraped_summary`, Gemini (`research_results`),
 * and Hermes cron (`/api/cron/zone-research`); do not ship long crawler prose here.
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

const PERSONALISE = 'Answer questions to personalise.'

export const UK_2026_MONEY_LEAD: Record<JourneyId, JourneyMoneyLead> = {
  home: {
    journey_key: 'home',
    money_lead: '£0 cost',
    money_value: 12000,
    carbon_backup: PERSONALISE,
    carbon_value: 850,
  },
  travel: {
    journey_key: 'travel',
    money_lead: '£500 grant',
    money_value: 500,
    carbon_backup: PERSONALISE,
    carbon_value: 400,
  },
  food: {
    journey_key: 'food',
    money_lead: '£1,000/yr',
    money_value: 1000,
    carbon_backup: PERSONALISE,
    carbon_value: 1200,
  },
  shopping: {
    journey_key: 'shopping',
    money_lead: '£400/yr',
    money_value: 400,
    carbon_backup: PERSONALISE,
    carbon_value: 500,
  },
  money: {
    journey_key: 'money',
    money_lead: '20% ROI',
    money_value: 1400,
    carbon_backup: PERSONALISE,
    carbon_value: 19000,
  },
  carbon: {
    journey_key: 'carbon',
    money_lead: '£117 drop',
    money_value: 117,
    carbon_backup: PERSONALISE,
    carbon_value: 200,
  },
  tech: {
    journey_key: 'tech',
    money_lead: '£200/yr',
    money_value: 200,
    carbon_backup: PERSONALISE,
    carbon_value: 300,
  },
  waste: {
    journey_key: 'waste',
    money_lead: '£150/yr',
    money_value: 150,
    carbon_backup: PERSONALISE,
    carbon_value: 350,
  },
  holidays: {
    journey_key: 'holidays',
    money_lead: '£300/yr',
    money_value: 300,
    carbon_backup: PERSONALISE,
    carbon_value: 1000,
  },
}
