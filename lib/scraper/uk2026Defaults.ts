/**
 * S UPDATE — UK Feb 2026 fiscal defaults (Money Lead)
 * 001 Scraper verified data; Zai agents use these for "Money Lead" justification.
 * Feeds dashboard hero totals until scraped_summary is synced.
 */

import type { JourneyId } from '@/lib/journeys'

export interface JourneyMoneyLead {
  journey_key: JourneyId
  money_lead: string
  money_value: number
  carbon_backup: string
  carbon_value: number
  crawler_tip?: string
  /** Agent focus for Zai (e.g. "Switch now to beat the standing charge rise.") */
  agent_focus?: string
}

export const UK_2026_MONEY_LEAD: Record<JourneyId, JourneyMoneyLead> = {
  home: {
    journey_key: 'home',
    money_lead: '£0 cost',
    money_value: 12000,
    carbon_backup: 'Fully funded solar & heat pumps (D–G rated)',
    carbon_value: 850,
    crawler_tip: 'Warm Homes: Local Grant (Updated Feb 3, 2026). Targeted at postcodes in Income Deciles 1–2. Fully funded solar & heat pumps for eligible D–G rated homes.',
    agent_focus: 'Switch now to beat the standing charge rise.',
  },
  travel: {
    journey_key: 'travel',
    money_lead: '£500 grant',
    money_value: 500,
    carbon_backup: '2p per mile',
    carbon_value: 400,
    crawler_tip: 'New EV Chargepoint Grant (Feb 25, 2026). Increased to £500 for renters and flat owners. Home charging costs slashed by 40% vs 2025 rates.',
    agent_focus: 'Your fuel cost is your biggest leverage point.',
  },
  food: {
    journey_key: 'food',
    money_lead: '£1,000/yr',
    money_value: 1000,
    carbon_backup: '£83/mo',
    carbon_value: 1200,
    crawler_tip: 'Family Waste Audit: WRAP data shows a family of four now loses £1,000/yr to edible waste. £83/mo immediate "pay rise" by mastering meal-planning.',
    agent_focus: 'Meal prep is a 20% ROI on your grocery bill.',
  },
  shopping: {
    journey_key: 'shopping',
    money_lead: '£400/yr',
    money_value: 400,
    carbon_backup: 'Circular savings',
    carbon_value: 500,
    crawler_tip: 'Ellen MacArthur Foundation — circular economy savings.',
  },
  money: {
    journey_key: 'money',
    money_lead: '20% ROI',
    money_value: 1400,
    carbon_backup: '19 Tonnes (Divestment)',
    carbon_value: 19000,
    crawler_tip: 'Green pension funds hitting 20% ROI in 2026.',
    agent_focus: 'Divestment is your largest single carbon win.',
  },
  carbon: {
    journey_key: 'carbon',
    money_lead: '£117 drop',
    money_value: 117,
    carbon_backup: '£1,641/yr',
    carbon_value: 200,
    crawler_tip: 'Energy Price Cap Drop: Ofgem confirms a £117 (7%) drop coming April 1, 2026. £1,641/yr new typical annual bill target for your region.',
  },
  tech: {
    journey_key: 'tech',
    money_lead: '£200/yr',
    money_value: 200,
    carbon_backup: 'Repair vs replace',
    carbon_value: 300,
    crawler_tip: 'Back Market & Restart Project — e-waste impact.',
  },
  waste: {
    journey_key: 'waste',
    money_lead: '£150/yr',
    money_value: 150,
    carbon_backup: 'Recycling efficiency',
    carbon_value: 350,
    crawler_tip: 'DEFRA Statistics — local authority recycling.',
  },
  holidays: {
    journey_key: 'holidays',
    money_lead: '£300/yr',
    money_value: 300,
    carbon_backup: 'Flight vs rail',
    carbon_value: 1000,
    crawler_tip: 'Eurostar & Skyscanner — UK–Europe routes.',
  },
}
