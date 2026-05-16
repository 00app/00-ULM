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
    grants: 'grants',
    solar: 'solar',
    travel: 'travel',
    holidays: 'holidays',
    food: 'food',
    shopping: 'shopping',
    money: 'money',
    tech: 'tech',
    water: 'water',
    waste: 'waste',
    carbon: 'carbon',
  }
  
  return categories[journey] || 'sustainability'
}

/**
 * Get copy for a card by journey and type
 */
export function getCardCopy(journey: JourneyId, type?: string): CardCopy {
  // Default copy structure - can be expanded with more specific content
  const defaultCopy: Record<JourneyId, CardCopy> = {
    grants: {
      title: 'check boiler upgrade scheme.',
      body: ['Older boilers may qualify for BUS grants toward heat pumps.', 'Match scheme rules to your postcode and benefits status.'],
      category: 'grants',
    },
    solar: {
      title: 'check south-facing yield.',
      body: ['Roof orientation and shading drive export value.', 'Daytime use improves payback on PV installs.'],
      category: 'solar',
    },
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
    water: {
      title: 'cut hot water waste.',
      body: ['Showers and butts reduce metered use.', 'Rain harvesting offsets garden demand.'],
      category: 'water',
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
