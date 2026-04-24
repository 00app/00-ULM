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
      { id: 'energy_type', label: 'What is your primary heating source?', type: 'options', options: ['GAS', 'ELECTRIC', 'WOOD', 'MIXED', 'SOLAR', 'UNKNOWN'] },
      {
        id: 'home_insulation_level',
        label: 'Is your home insulated?',
        type: 'options',
        options: ['YES', 'NO', 'PARTIAL'],
      },
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
      { id: 'primary_transport', label: 'How do you usually commute?', type: 'options', options: ['CAR', 'BUS', 'TRAIN', 'BIKE', 'WALK'] },
      { id: 'fuel_type', label: 'fuel type?', type: 'options', options: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'NONE'] },
      { id: 'distance_amount', label: 'distance?', type: 'number', repeatLabel: 'even a rough estimate helps — how many miles?' },
      { id: 'distance_period', label: 'per week or per month?', type: 'options', options: ['WEEK', 'MONTH'] },
    ],
  },
  food: {
    id: 'food',
    name: 'food',
    questions: [
      { id: 'diet_type', label: 'What best describes your diet?', type: 'options', options: ['OMNIVORE', 'FLEXI', 'VEGETARIAN', 'VEGAN'] },
      { id: 'food_waste', label: 'food waste?', type: 'options', options: ['LOW', 'MEDIUM', 'HIGH'] },
    ],
  },
  shopping: {
    id: 'shopping',
    name: 'shopping',
    questions: [
      { id: 'buy_new', label: 'How often do you buy brand new?', type: 'options', options: ['OFTEN', 'SOMETIMES', 'RARELY'] },
      { id: 'secondhand', label: 'buy secondhand?', type: 'options', options: ['YES', 'NO'] },
      { id: 'monthly_spend', label: 'monthly spend?', type: 'number', repeatLabel: 'even a rough estimate helps — how much do you spend?' },
    ],
  },
  money: {
    id: 'money',
    name: 'money',
    questions: [
      { id: 'biggest_cost', label: 'What is your biggest monthly cost?', type: 'options', options: ['HOUSING', 'ENERGY', 'FOOD', 'TRAVEL'] },
      { id: 'finances_tight', label: 'Are your finances tight?', type: 'options', options: ['YES', 'NO'] },
    ],
  },
  carbon: {
    id: 'carbon',
    name: 'carbon',
    questions: [
      { id: 'tracking', label: 'Do you track your carbon?', type: 'options', options: ['YES', 'NO'] },
      { id: 'priority', label: 'How do you prioritize carbon?', type: 'options', options: ['LOW', 'MEDIUM', 'HIGH'] },
    ],
  },
  tech: {
    id: 'tech',
    name: 'tech',
    questions: [
      { id: 'upgrade_often', label: 'How often do you upgrade your phone?', type: 'options', options: ['YES', 'NO'] },
      { id: 'device_count', label: 'device count?', type: 'options', options: ['FEW', 'AVERAGE', 'MANY'] },
    ],
  },
  waste: {
    id: 'waste',
    name: 'waste',
    questions: [
      { id: 'recycle', label: 'How often do you recycle?', type: 'options', options: ['ALWAYS', 'SOMETIMES', 'NEVER'] },
      { id: 'compost', label: 'compost?', type: 'options', options: ['YES', 'NO'] },
    ],
  },
  holidays: {
    id: 'holidays',
    name: 'holidays',
    questions: [
      { id: 'fly_frequency', label: 'How often do you fly?', type: 'options', options: ['NEVER', 'YEARLY', 'OFTEN'] },
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

/** Zero Zero v1.3 — Context Trap: short punchy question per journey (embedded card). Roboto 900. */
export const FUNKY_QUESTION_LABEL: Record<string, string> = {
  home: 'What is your primary heating source?',
  travel: 'How do you usually commute?',
  food: 'What best describes your diet?',
  shopping: 'How often do you buy brand new?',
  money: 'What is your biggest monthly cost?',
  carbon: 'Do you track your carbon?',
  tech: 'How often do you upgrade your phone?',
  waste: 'How often do you recycle?',
  holidays: 'How often do you fly?',
}

/** Zero Zero Funky: option value → one-word circle label (Roboto Bold). Stored value unchanged. */
const FUNKY_OPTION_DISPLAY: Record<string, string> = {
  // Home — heating
  GAS: 'GAS',
  ELECTRIC: 'ELEC',
  WOOD: 'WOOD',
  MIXED: 'MIX',
  SOLAR: 'SOLAR',
  UNKNOWN: '?',
  // Home — providers
  OCTOPUS: 'OCT',
  BRITISH_GAS: 'BG',
  EDF: 'EDF',
  EON: 'EON',
  OVO: 'OVO',
  SCOTTISH_POWER: 'SP',
  SHELL: 'SHELL',
  UTILITA: 'UTIL',
  OTHER: 'OTHER',
  // Travel
  CAR: 'CAR',
  BUS: 'BUS',
  TRAIN: 'RAIL',
  BIKE: 'BIKE',
  WALK: 'WALK',
  PETROL: 'PET',
  DIESEL: 'DIES',
  HYBRID: 'HYB',
  NONE: 'NONE',
  WEEK: 'WEEK',
  MONTH: 'MO',
  PUBLIC: 'BUS',
  // Food
  OMNIVORE: 'MEAT',
  FLEXI: 'FLEX',
  VEGETARIAN: 'VEG',
  VEGAN: 'PLANT',
  LOW: 'LOW',
  MEDIUM: 'MID',
  HIGH: 'HIGH',
  // Shopping
  OFTEN: 'OFTEN',
  SOMETIMES: 'SOME',
  RARELY: 'RARE',
  // Money
  HOUSING: 'HOME',
  ENERGY: 'ENERGY',
  FOOD: 'FOOD',
  TRAVEL: 'TRIP',
  // Carbon / Tech / Waste / Holidays — YES/NO context-dependent
  YES: 'YES',
  NO: 'NO',
  PARTIAL: 'PART',
  ALWAYS: 'ALL',
  NEVER: 'NONE',
  YEARLY: 'YEAR',
  FEW: 'FEW',
  AVERAGE: 'AVG',
  MANY: 'MANY',
}

export function getFunkyOptionDisplay(opt: string): string {
  return FUNKY_OPTION_DISPLAY[opt] ?? (opt.length > 5 ? opt.slice(0, 5) : opt)
}

/** Full words for dropdowns / solo-focus (Marvin H4). Stored value unchanged. */
export const OPTION_FULL_LABELS: Record<string, string> = {
  GAS: 'Gas',
  ELECTRIC: 'Elec',
  WOOD: 'Wood',
  MIXED: 'Mixed',
  SOLAR: 'Solar',
  UNKNOWN: 'Unknown',
  OCTOPUS: 'Octopus',
  BRITISH_GAS: 'BritGas',
  EDF: 'EDF',
  EON: 'E.ON',
  OVO: 'OVO',
  SCOTTISH_POWER: 'ScotPwr',
  SHELL: 'Shell',
  UTILITA: 'Utilita',
  OTHER: 'Other',
  CAR: 'Car',
  BUS: 'Bus',
  TRAIN: 'Train',
  BIKE: 'Bike',
  WALK: 'Walk',
  PETROL: 'Petrol',
  DIESEL: 'Diesel',
  HYBRID: 'Hybrid',
  NONE: 'None',
  WEEK: 'Week',
  MONTH: 'Month',
  PUBLIC: 'Transit',
  OMNIVORE: 'AllFood',
  FLEXI: 'Flexi',
  VEGETARIAN: 'Veggie',
  VEGAN: 'Vegan',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  OFTEN: 'Often',
  SOMETIMES: 'Partial',
  RARELY: 'Rarely',
  YES: 'Yes',
  NO: 'No',
  PARTIAL: 'Partial',
  NOT_SURE: 'Unsure',
  UNSURE: 'Unsure',
  HOUSING: 'Housing',
  ENERGY: 'Energy',
  FOOD: 'Food',
  TRAVEL: 'Travel',
  ALWAYS: 'Always',
  NEVER: 'Never',
  YEARLY: 'Yearly',
  FEW: 'Few',
  AVERAGE: 'Average',
  MANY: 'Many',
}

export function getOptionFullLabel(opt: string): string {
  if (OPTION_FULL_LABELS[opt]) return OPTION_FULL_LABELS[opt]
  return opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Security: whitelist for API validation. */
export function isValidJourneyId(id: string): id is JourneyId {
  return JOURNEY_IDS.includes(id as JourneyId)
}

export function isValidJourneyQuestion(journeyId: string, questionId: string): boolean {
  if (!isValidJourneyId(journeyId)) return false
  const def = JOURNEYS[journeyId as JourneyId]
  return def?.questions?.some((q) => q.id === questionId) ?? false
}

/** True when every question in the journey has a non-empty stored answer. */
export function isJourneyComplete(
  journeyId: JourneyId,
  answers: Partial<Record<JourneyId, Record<string, string>>>
): boolean {
  const def = JOURNEYS[journeyId]
  if (!def?.questions?.length) return false
  const row = answers[journeyId]
  if (!row) return false
  return def.questions.every((q) => {
    const v = row[q.id]
    return v !== undefined && v !== null && String(v).trim() !== ''
  })
}
