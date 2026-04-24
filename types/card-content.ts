import { JourneyId } from '@/lib/journeys'

export interface CardContent {
  id: string
  journey: JourneyId
  type: 'cheapest' | 'greenest' | 'balance' | 'tip'
  title: string                // used on cards (max 3 lines)
  body: string[]               // optional body paragraphs for card detail copy
  sourceUrl: string            // Learn more link
  action?: {
    type: 'switch' | 'buy' | 'start'
    label: string
    url: string
  }
  carbonRule: CarbonRule
  moneyRule?: MoneyRule
  imageKey: string             // deterministic image lookup
}

export interface CarbonRule {
  unit: 'kwh' | 'mile' | 'kg' | 'item'
  factor: number          // kg CO₂e per unit
  source: 'DEFRA' | 'IEA' | 'BEIS'
}

export interface MoneyRule {
  unit: 'month' | 'year' | 'item'
  savingPerUnit: number
}
