import { JourneyId } from '@/lib/journeys'

export type QuestionType = 'options' | 'number'

export interface LockedQuestion {
  id: string
  question: string
  type: QuestionType
  options?: string[]
}

export const JOURNEY_QUESTIONS: Record<JourneyId, LockedQuestion[]> = {
  home: [
    { id: 'energy_type', question: 'energy type?', type: 'options',
      options: ['GAS', 'ELECTRIC', 'MIXED', 'SOLAR', 'UNKNOWN'] },
    { id: 'electricity_provider', question: 'electricity provider?', type: 'options',
      options: ['OCTOPUS','BRITISH_GAS','EDF','EON','OVO','SCOTTISH_POWER','SHELL','UTILITA','OTHER'] },
    { id: 'gas_provider', question: 'gas provider?', type: 'options',
      options: ['OCTOPUS','BRITISH_GAS','EDF','EON','OVO','SCOTTISH_POWER','SHELL','UTILITA','OTHER'] },
    { id: 'monthly_cost', question: 'monthly cost?', type: 'number' },
    { id: 'green_tariff', question: 'green tariff?', type: 'options',
      options: ['YES','NO','UNKNOWN'] },
  ],

  travel: [
    { id: 'primary_transport', question: 'main transport?', type: 'options',
      options: ['CAR','BUS','TRAIN','BIKE','WALK'] },
    { id: 'fuel_type', question: 'fuel type?', type: 'options',
      options: ['PETROL','DIESEL','ELECTRIC','HYBRID','NONE'] },
    { id: 'weekly_distance', question: 'weekly distance?', type: 'number' },
  ],

  food: [
    { id: 'diet_type', question: 'diet?', type: 'options',
      options: ['OMNIVORE','FLEXI','VEGETARIAN','VEGAN'] },
    { id: 'food_waste', question: 'food waste?', type: 'options',
      options: ['LOW','MEDIUM','HIGH'] },
  ],

  shopping: [
    { id: 'buy_new', question: 'buy new?', type: 'options',
      options: ['OFTEN','SOMETIMES','RARELY'] },
    { id: 'secondhand', question: 'buy secondhand?', type: 'options',
      options: ['YES','NO'] },
    { id: 'monthly_spend', question: 'monthly spend?', type: 'number' },
  ],

  money: [
    { id: 'finances_tight', question: 'finances tight?', type: 'options',
      options: ['YES','NO'] },
    { id: 'biggest_cost', question: 'biggest cost?', type: 'options',
      options: ['HOUSING','ENERGY','FOOD','TRAVEL'] },
  ],

  carbon: [
    { id: 'priority', question: 'carbon priority?', type: 'options',
      options: ['LOW','MEDIUM','HIGH'] },
    { id: 'tracking', question: 'track carbon?', type: 'options',
      options: ['YES','NO'] },
  ],

  tech: [
    { id: 'upgrade_often', question: 'upgrade often?', type: 'options',
      options: ['YES','NO'] },
    { id: 'device_count', question: 'device count?', type: 'options',
      options: ['FEW','AVERAGE','MANY'] },
  ],

  waste: [
    { id: 'recycle', question: 'recycle?', type: 'options',
      options: ['ALWAYS','SOMETIMES','NEVER'] },
    { id: 'compost', question: 'compost?', type: 'options',
      options: ['YES','NO'] },
  ],

  holidays: [
    { id: 'fly_frequency', question: 'fly how often?', type: 'options',
      options: ['NEVER','YEARLY','OFTEN'] },
    { id: 'long_haul', question: 'long haul?', type: 'options',
      options: ['YES','NO'] },
  ],
}
