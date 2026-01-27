import { JourneyId } from '@/lib/journeys'
import { CardContent } from '@/types/card-content'

/**
 * Starter card content for all 9 journeys
 * Factual, neutral content. No marketing language. No promises.
 */
export const CARD_CONTENT: CardContent[] = [
  // HOME / ENERGY
  {
    id: 'home-smart-meter',
    journey: 'home',
    type: 'balance',
    title: 'switch to a smart meter.',
    body: [
      'Smart meters show how much energy your home uses in real time.',
      'Seeing usage patterns can help reduce wasted electricity and gas.'
    ],
    sourceUrl: 'https://www.gov.uk/guidance/smart-meters-how-they-work',
    action: {
      type: 'switch',
      label: 'switch',
      url: 'https://www.smartenergygb.org'
    },
    imageKey: 'home',
    carbonRule: {
      unit: 'kwh',
      factor: 0.193,
      source: 'DEFRA'
    },
    moneyRule: {
      unit: 'year',
      savingPerUnit: 65
    }
  },

  // TRAVEL
  {
    id: 'travel-drive-less',
    journey: 'travel',
    type: 'greenest',
    title: 'reduce short car journeys.',
    body: [
      'Short car trips are often the most carbon-intensive per mile.',
      'Walking, cycling, or public transport can significantly cut emissions.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023',
    action: {
      type: 'start',
      label: 'start',
      url: 'https://www.gov.uk/plan-your-journey'
    },
    imageKey: 'travel',
    carbonRule: {
      unit: 'mile',
      factor: 0.404,
      source: 'DEFRA'
    }
  },

  // FOOD
  {
    id: 'food-eat-less-beef',
    journey: 'food',
    type: 'greenest',
    title: 'eat less beef.',
    body: [
      'Beef production has one of the highest carbon footprints of any food.',
      'Reducing beef consumption can significantly lower diet-related emissions.'
    ],
    sourceUrl: 'https://www.iea.org/reports/food-systems-and-climate-change',
    imageKey: 'food',
    carbonRule: {
      unit: 'kg',
      factor: 27.0,
      source: 'IEA'
    }
  },

  // SHOPPING
  {
    id: 'shopping-buy-second-hand',
    journey: 'shopping',
    type: 'balance',
    title: 'choose second-hand first.',
    body: [
      'Buying second-hand extends the life of products and reduces waste.',
      'This can save money and reduce the environmental impact of manufacturing.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/waste-prevention-programme',
    imageKey: 'shopping',
    carbonRule: {
      unit: 'item',
      factor: 0,
      source: 'DEFRA'
    },
    moneyRule: {
      unit: 'item',
      savingPerUnit: 50
    }
  },

  // MONEY
  {
    id: 'money-review-bills',
    journey: 'money',
    type: 'cheapest',
    title: 'review your regular bills.',
    body: [
      'Regular bills can often be reduced by switching providers or reviewing usage.',
      'Small savings across multiple bills can add up significantly.'
    ],
    sourceUrl: 'https://www.ofgem.gov.uk/information-consumers',
    imageKey: 'money',
    carbonRule: {
      unit: 'item',
      factor: 0,
      source: 'DEFRA'
    },
    moneyRule: {
      unit: 'month',
      savingPerUnit: 30
    }
  },

  // CARBON
  {
    id: 'carbon-understand-footprint',
    journey: 'carbon',
    type: 'tip',
    title: 'understand your carbon footprint.',
    body: [
      'Knowing where your emissions come from helps you make informed choices.',
      'Small changes in high-impact areas can make a real difference.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023',
    imageKey: 'carbon',
    carbonRule: {
      unit: 'item',
      factor: 0,
      source: 'DEFRA'
    }
  },

  // TECH
  {
    id: 'tech-extend-device-life',
    journey: 'tech',
    type: 'greenest',
    title: 'extend your device life.',
    body: [
      'Electronic devices have a high environmental cost to manufacture.',
      'Keeping devices longer and repairing instead of replacing reduces impact.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/waste-electrical-and-electronic-equipment',
    imageKey: 'tech',
    carbonRule: {
      unit: 'item',
      factor: 0,
      source: 'DEFRA'
    },
    moneyRule: {
      unit: 'item',
      savingPerUnit: 150
    }
  },

  // WASTE
  {
    id: 'waste-reduce-food-waste',
    journey: 'waste',
    type: 'balance',
    title: 'reduce food waste.',
    body: [
      'Food waste contributes significantly to carbon emissions.',
      'Planning meals and using leftovers can save money and reduce waste.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/food-waste-reduction-roadmap',
    imageKey: 'waste',
    carbonRule: {
      unit: 'kg',
      factor: 0.5,
      source: 'DEFRA'
    },
    moneyRule: {
      unit: 'month',
      savingPerUnit: 40
    }
  },

  // HOLIDAYS
  {
    id: 'holidays-choose-closer-destinations',
    journey: 'holidays',
    type: 'greenest',
    title: 'choose closer destinations.',
    body: [
      'Travel emissions increase dramatically with distance.',
      'Exploring local and regional destinations can be both affordable and lower impact.'
    ],
    sourceUrl: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023',
    imageKey: 'holidays',
    carbonRule: {
      unit: 'mile',
      factor: 0.404,
      source: 'DEFRA'
    }
  }
]
