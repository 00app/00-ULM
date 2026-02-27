export const JOURNEY_IDS = [
  'home',
  'travel',
  'food',
  'shopping',
  'money',
  'carbon',
  'tech',
  'waste',
  'holidays',
] as const

export const JOURNEY_ORDER = JOURNEY_IDS

export type JourneyId = (typeof JOURNEY_IDS)[number]

export interface JourneyQuestion {
  id: string
  label: string
  type: 'options' | 'number'
  options?: string[]
  repeatLabel?: string
}

export interface JourneyDefinition {
  id: JourneyId
  name: string
  questions: JourneyQuestion[]
}

export const JOURNEYS: Record<JourneyId, JourneyDefinition> = {
  home: {
    id: 'home',
    name: 'home',
    questions: [
      { id: 'energy_type', label: 'energy type?', type: 'options', options: ['GAS', 'ELECTRIC', 'MIXED', 'SOLAR', 'UNKNOWN'] },
      { id: 'electricity_provider', label: 'electricity provider?', type: 'options', options: ['OCTOPUS', 'BRITISH_GAS', 'EDF', 'EON', 'OVO', 'SCOTTISH_POWER', 'SHELL', 'UTILITA', 'OTHER'] },
      { id: 'gas_provider', label: 'gas provider?', type: 'options', options: ['OCTOPUS', 'BRITISH_GAS', 'EDF', 'EON', 'OVO', 'SCOTTISH_POWER', 'SHELL', 'UTILITA', 'OTHER'] },
      { id: 'monthly_cost', label: 'monthly cost?', type: 'number', repeatLabel: 'even a rough estimate helps — what do you spend each month?' },
      { id: 'green_tariff', label: 'green tariff?', type: 'options', options: ['YES', 'NO', 'UNKNOWN'] },
    ],
  },
  travel: {
    id: 'travel',
    name: 'travel',
    questions: [
      { id: 'primary_transport', label: 'main transport?', type: 'options', options: ['CAR', 'BUS', 'TRAIN', 'BIKE', 'WALK'] },
      { id: 'fuel_type', label: 'fuel type?', type: 'options', options: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'NONE'] },
      { id: 'distance_amount', label: 'distance?', type: 'number', repeatLabel: 'even a rough estimate helps — how many miles?' },
      { id: 'distance_period', label: 'per week or per month?', type: 'options', options: ['WEEK', 'MONTH'] },
    ],
  },
  food: {
    id: 'food',
    name: 'food',
    questions: [
      { id: 'diet_type', label: 'diet?', type: 'options', options: ['OMNIVORE', 'FLEXI', 'VEGETARIAN', 'VEGAN'] },
      { id: 'food_waste', label: 'food waste?', type: 'options', options: ['LOW', 'MEDIUM', 'HIGH'] },
    ],
  },
  shopping: {
    id: 'shopping',
    name: 'shopping',
    questions: [
      { id: 'buy_new', label: 'buy new?', type: 'options', options: ['OFTEN', 'SOMETIMES', 'RARELY'] },
      { id: 'secondhand', label: 'buy secondhand?', type: 'options', options: ['YES', 'NO'] },
      { id: 'monthly_spend', label: 'monthly spend?', type: 'number', repeatLabel: 'even a rough estimate helps — how much do you spend?' },
    ],
  },
  money: {
    id: 'money',
    name: 'money',
    questions: [
      { id: 'finances_tight', label: 'finances tight?', type: 'options', options: ['YES', 'NO'] },
      { id: 'biggest_cost', label: 'biggest cost?', type: 'options', options: ['HOUSING', 'ENERGY', 'FOOD', 'TRAVEL'] },
    ],
  },
  carbon: {
    id: 'carbon',
    name: 'carbon',
    questions: [
      { id: 'priority', label: 'carbon priority?', type: 'options', options: ['LOW', 'MEDIUM', 'HIGH'] },
      { id: 'tracking', label: 'track carbon?', type: 'options', options: ['YES', 'NO'] },
    ],
  },
  tech: {
    id: 'tech',
    name: 'tech',
    questions: [
      { id: 'upgrade_often', label: 'upgrade often?', type: 'options', options: ['YES', 'NO'] },
      { id: 'device_count', label: 'device count?', type: 'options', options: ['FEW', 'AVERAGE', 'MANY'] },
    ],
  },
  waste: {
    id: 'waste',
    name: 'waste',
    questions: [
      { id: 'recycle', label: 'recycle?', type: 'options', options: ['ALWAYS', 'SOMETIMES', 'NEVER'] },
      { id: 'compost', label: 'compost?', type: 'options', options: ['YES', 'NO'] },
    ],
  },
  holidays: {
    id: 'holidays',
    name: 'holidays',
    questions: [
      { id: 'fly_frequency', label: 'fly how often?', type: 'options', options: ['NEVER', 'YEARLY', 'OFTEN'] },
      { id: 'long_haul', label: 'long haul?', type: 'options', options: ['YES', 'NO'] },
    ],
  },
}

export function getNextJourney(currentJourneyId: JourneyId | null, completedJourneys: JourneyId[]): JourneyId | null {
  if (!currentJourneyId) return JOURNEY_ORDER[0]
  const i = JOURNEY_ORDER.indexOf(currentJourneyId)
  if (i === -1) return null
  for (let j = i + 1; j < JOURNEY_ORDER.length; j++) {
    if (!completedJourneys.includes(JOURNEY_ORDER[j])) return JOURNEY_ORDER[j]
  }
  return null
}

export const JOURNEY_LABELS: Record<JourneyId, string> = {
  home: 'Home',
  travel: 'Travel',
  food: 'Food',
  shopping: 'Shopping',
  money: 'Money',
  carbon: 'Carbon',
  tech: 'Tech',
  waste: 'Waste',
  holidays: 'Holidays',
}

export const JOURNEY_COLORS: Record<JourneyId, string> = {
  home: 'var(--color-j-home)',
  travel: 'var(--color-j-travel)',
  food: 'var(--color-j-food)',
  shopping: 'var(--color-j-shopping)',
  money: 'var(--color-j-money)',
  carbon: 'var(--color-j-carbon)',
  tech: 'var(--color-j-tech)',
  waste: 'var(--color-j-waste)',
  holidays: 'var(--color-j-holidays)',
}
