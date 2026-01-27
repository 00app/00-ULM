/**
 * Card content and copy
 * Factual, neutral content only
 */

import { JourneyId } from '@/lib/journeys'

export interface CardCopy {
  title: string
  body: string[]
  category: string
}

/**
 * Get category label for a journey
 */
export function getCategoryLabel(journey: JourneyId): string {
  const categories: Record<JourneyId, string> = {
    home: 'home',
    travel: 'travel',
    food: 'food',
    shopping: 'shopping',
    money: 'money',
    carbon: 'carbon',
    tech: 'tech',
    waste: 'waste',
    holidays: 'holidays',
  }
  
  return categories[journey] || 'sustainability'
}

/**
 * Get copy for a card by journey and type
 */
export function getCardCopy(journey: JourneyId, type?: string): CardCopy {
  // Default copy structure - can be expanded with more specific content
  const defaultCopy: Record<JourneyId, CardCopy> = {
    home: {
      title: 'switch to a smart meter.',
      body: [
        'Smart meters show how much energy your home uses in real time.',
        'Seeing usage patterns can help reduce wasted electricity and gas.',
      ],
      category: 'home',
    },
    travel: {
      title: 'reduce short car journeys.',
      body: [
        'Short car trips are often the most carbon-intensive per mile.',
        'Walking, cycling, or public transport can significantly cut emissions.',
      ],
      category: 'travel',
    },
    food: {
      title: 'eat less beef.',
      body: [
        'Beef production has one of the highest carbon footprints of any food.',
        'Reducing beef consumption can significantly lower diet-related emissions.',
      ],
      category: 'food',
    },
    shopping: {
      title: 'choose second-hand first.',
      body: [
        'Buying pre-owned items reduces demand for new production.',
        'This saves resources and lowers the carbon footprint of goods.',
      ],
      category: 'shopping',
    },
    money: {
      title: 'review your monthly bills.',
      body: [
        'Regularly checking subscriptions and utility providers can uncover savings.',
        'Switching providers or cancelling unused services can reduce costs.',
      ],
      category: 'money',
    },
    carbon: {
      title: 'understand your carbon footprint.',
      body: [
        'Knowing where your emissions come from is the first step to reducing them.',
        'Tools and calculators can help you identify key areas of impact.',
      ],
      category: 'carbon',
    },
    tech: {
      title: 'extend device life.',
      body: [
        'Manufacturing electronics is resource-intensive and creates significant emissions.',
        'Repairing, upgrading, or buying refurbished extends their useful life.',
      ],
      category: 'tech',
    },
    waste: {
      title: 'start composting food waste.',
      body: [
        'Food waste in landfill produces methane, a potent greenhouse gas.',
        'Composting diverts this waste and creates nutrient-rich soil.',
      ],
      category: 'waste',
    },
    holidays: {
      title: 'explore local holidays.',
      body: [
        'Air travel has a high carbon footprint per passenger mile.',
        'Choosing holidays closer to home can significantly reduce emissions.',
      ],
      category: 'holidays',
    },
  }

  return defaultCopy[journey] || {
    title: 'explore your options.',
    body: ['Learn more about sustainability and its impact.'],
    category: 'sustainability',
  }
}
