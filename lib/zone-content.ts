// ❌ DEPRECATED — DO NOT USE
// Replaced by buildZoneViewModel.ts
// 
// Zone content MUST come from: lib/zone/buildZoneViewModel.ts
// All calculations MUST come from: lib/brains/calculations.ts
// 
// This file is kept for reference only and should not be imported.

/**
 * Zone Content Builder - Returns content model only, never UI
 * All calculations are data-driven from carbon/money rules
 */

import { JourneyId } from './journeys'
import { CardContent, CarbonRule, MoneyRule } from '@/types/card-content'
import { getCarbonRule, calculateCarbon } from './carbon-rules'
import { getMoneyRule, calculateMoney } from './money-rules'
import { formatCarbon } from './format'

export interface ZoneContentResult {
  hero: CardContent | null
  latest: CardContent[]
  doNext: CardContent[]
}

interface JourneyAnswers {
  [journeyId: string]: Record<string, string>
}

interface UserProfile {
  name?: string
  household?: string
  home_type?: string
  transport_baseline?: string
}

/**
 * Build zone content from completed journeys
 * Returns content model with calculations
 */
export function buildZoneContent({
  completedJourneyIds,
  journeyAnswers,
  profile,
}: {
  completedJourneyIds: JourneyId[]
  journeyAnswers: JourneyAnswers
  profile: UserProfile
}): ZoneContentResult {
  let hero: CardContent | null = null
  const latest: CardContent[] = []
  const doNext: CardContent[] = []

  // Generate cards from completed journeys
  completedJourneyIds.forEach((journeyId) => {
    const answers = journeyAnswers[journeyId] || {}
    const cards = generateContentForJourney(journeyId, answers)
    
    // First card from most recent journey becomes hero
    if (cards.length > 0 && !hero) {
      const heroCard = cards[0]
      // Convert to hero variant
      hero = {
        ...heroCard,
        id: `${heroCard.id}-hero`,
      }
      latest.push(...cards.slice(1))
    } else {
      latest.push(...cards)
    }
  })

  // Generate "do next" cards from incomplete journeys
  const allJourneyIds: JourneyId[] = ['home', 'travel', 'food', 'shopping', 'money', 'carbon', 'tech', 'waste', 'holidays']
  const incompleteJourneyIds = allJourneyIds.filter(id => !completedJourneyIds.includes(id))
  
  incompleteJourneyIds.forEach((journeyId) => {
    const cards = generateContentForJourney(journeyId, {})
    doNext.push(...cards.slice(0, 2)) // Top 2 from each incomplete journey
  })

  // Ensure exactly 1 hero, 6 latest, 6 doNext
  // Pad with defaults if needed
  const defaultHero = createDefaultContent('home', 'tip')
  const defaultLatest = Array.from({ length: 6 }, (_, i) => 
    createDefaultContent('home', 'balance', `latest-${i}`)
  )
  const defaultDoNext = Array.from({ length: 6 }, (_, i) => 
    createDefaultContent('home', 'tip', `donext-${i}`)
  )

  return {
    hero: hero || defaultHero,
    latest: latest.slice(0, 6).concat(defaultLatest.slice(latest.length)),
    doNext: doNext.slice(0, 6).concat(defaultDoNext.slice(doNext.length)),
  }
}

/**
 * Generate content cards for a journey based on answers
 */
function generateContentForJourney(
  journeyId: JourneyId,
  answers: Record<string, string>
): CardContent[] {
  const cards: CardContent[] = []

  switch (journeyId) {
    case 'home': {
      // Smart meter card
      if (answers.smart_meter === 'NO') {
        const monthlyKwh = parseFloat(answers.monthly_cost || '100')
        const carbonRule = getCarbonRule('electricity_kwh')
        const moneyRule = getMoneyRule('smart_meter_month')
        
        cards.push({
          id: `home-smart-meter`,
          journey: 'home',
          type: 'cheapest',
          title: 'switch to a smart meter. money and energy.',
          body: [
            'smart meters help you see your energy use in real time. this can help you reduce consumption.',
            'most suppliers offer free installation and you can save on your bills.'
          ],
          sourceUrl: 'https://www.gov.uk/guidance/smart-meters-how-they-work',
          action: {
            type: 'switch',
            label: 'switch',
            url: 'https://www.gov.uk/guidance/smart-meters-how-they-work',
          },
          carbonRule: carbonRule || { unit: 'kwh', factor: 0.193, source: 'DEFRA' },
          moneyRule: moneyRule || { unit: 'month', savingPerUnit: 25 },
          imageKey: 'home',
        })
      }

      // Green tariff card
      if (answers.green_tariff === 'NO') {
        const carbonRule = getCarbonRule('electricity_kwh')
        const moneyRule = getMoneyRule('green_tariff_year')
        
        cards.push({
          id: `home-green-tariff`,
          journey: 'home',
          type: 'greenest',
          title: 'move to a green tariff. reduce your carbon.',
          body: [
            'green tariffs use renewable energy sources. switching can reduce your carbon footprint significantly.',
            'some green tariffs are competitively priced with standard tariffs.'
          ],
          sourceUrl: 'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/green-tariffs',
          action: {
            type: 'switch',
            label: 'switch',
            url: 'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/green-tariffs',
          },
          carbonRule: carbonRule || { unit: 'kwh', factor: 0.193, source: 'DEFRA' },
          moneyRule: moneyRule || { unit: 'year', savingPerUnit: 100 },
          imageKey: 'home',
        })
      }

      // Balance card (always shown)
      cards.push({
        id: `home-understand`,
        journey: 'home',
        type: 'balance',
        title: 'see how your energy is priced.',
        body: [
          'understanding your energy bills helps you make informed choices.',
        ],
        sourceUrl: 'https://www.gov.uk/energy-efficiency',
        carbonRule: { unit: 'item', factor: 0, source: 'DEFRA' },
        imageKey: 'home',
      })
      break
    }

    case 'travel': {
      // Reduce trips card
      if (answers.how_often === 'DAILY' || answers.how_often === 'WEEKLY') {
        const weeklyDistance = parseFloat(answers.weekly_distance || '50')
        const carbonRule = getCarbonRule('petrol_mile')
        
        cards.push({
          id: `travel-reduce`,
          journey: 'travel',
          type: 'greenest',
          title: 'reduce one regular trip. cut carbon.',
          body: [
            'cutting one regular car journey each week can significantly reduce your carbon footprint.',
            'consider walking, cycling, or public transport for shorter trips.'
          ],
          sourceUrl: 'https://www.gov.uk/government/publications/car-fuel-economy',
          action: {
            type: 'start',
            label: 'start',
            url: 'https://www.gov.uk/government/publications/car-fuel-economy',
          },
          carbonRule: carbonRule || { unit: 'mile', factor: 0.404, source: 'DEFRA' },
          imageKey: 'travel',
        })
      }

      // Switch mode card
      if (answers.priority && answers.priority !== 'COST') {
        const carbonRule = getCarbonRule('train_mile')
        
        cards.push({
          id: `travel-switch`,
          journey: 'travel',
          type: 'balance',
          title: 'swap one journey mode. try something different.',
          body: [
            'switching from car to train or bus for longer journeys can reduce your carbon footprint.',
            'many routes are well-served by public transport.'
          ],
          sourceUrl: 'https://www.gov.uk/government/publications/transport-statistics',
          carbonRule: carbonRule || { unit: 'mile', factor: 0.041, source: 'DEFRA' },
          imageKey: 'travel',
        })
      }

      // Info card (always shown)
      cards.push({
        id: `travel-compare`,
        journey: 'travel',
        type: 'tip',
        title: 'compare travel options. see the trade-offs.',
        body: [
          'every travel option has different costs and carbon impacts.',
        ],
        sourceUrl: 'https://www.gov.uk/government/publications/transport-statistics',
        carbonRule: { unit: 'item', factor: 0, source: 'DEFRA' },
        imageKey: 'travel',
      })
      break
    }

    // Add other journeys similarly...
    default:
      // Fallback content
      cards.push({
        id: `${journeyId}-default`,
        journey: journeyId,
        type: 'tip',
        title: `explore ${journeyId}. learn more.`,
        body: ['start this journey to get personalized recommendations.'],
        sourceUrl: 'https://www.gov.uk',
        carbonRule: { unit: 'item', factor: 0, source: 'DEFRA' },
        imageKey: journeyId,
      })
  }

  return cards
}

/**
 * Create default content for padding
 */
function createDefaultContent(
  journey: JourneyId,
  type: 'cheapest' | 'greenest' | 'balance' | 'tip',
  id?: string
): CardContent {
  return {
    id: id || `${journey}-default`,
    journey,
    type,
    title: 'explore your options. see what works for you.',
    body: ['complete journeys to get personalized recommendations.'],
    sourceUrl: 'https://www.gov.uk',
    carbonRule: { unit: 'item', factor: 0, source: 'DEFRA' },
    imageKey: journey,
  }
}

/**
 * Calculate carbon value from content and user data
 */
export function calculateContentCarbon(
  content: CardContent,
  userAnswers: Record<string, string>
): number {
  // Extract amount from user answers based on journey
  let amount = 0
  
  if (content.journey === 'home') {
    const monthlyCost = parseFloat(userAnswers.monthly_cost || '100')
    amount = monthlyCost // Use cost as proxy for kwh (rough estimate)
  } else if (content.journey === 'travel') {
    const weeklyDistance = parseFloat(userAnswers.weekly_distance || '50')
    amount = weeklyDistance * 52 // Annual miles
  }
  
  return calculateCarbon(content.carbonRule, amount)
}

/**
 * Calculate money value from content and user data
 */
export function calculateContentMoney(
  content: CardContent,
  userAnswers: Record<string, string>
): number {
  if (!content.moneyRule) return 0
  
  // Extract amount from user answers based on rule unit
  let amount = 1 // Default to 1 unit
  
  if (content.moneyRule.unit === 'month') {
    amount = 12 // Annual savings
  } else if (content.moneyRule.unit === 'year') {
    amount = 1
  }
  
  return calculateMoney(content.moneyRule, amount)
}
