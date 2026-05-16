/** Twelve-domain intelligence loop — 3 questions per category (Infrastructure / Behaviour / Readiness). */
export const JOURNEY_IDS = [
  'home',
  'grants',
  'solar',
  'travel',
  'holidays',
  'food',
  'shopping',
  'money',
  'tech',
  'water',
  'waste',
  'carbon',
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
      {
        id: 'property_type',
        label: 'Is your property detached or semi-detached?',
        type: 'options',
        options: ['DETACHED', 'SEMI', 'TERRACED', 'FLAT'],
      },
      {
        id: 'insulation_level',
        label: 'Current insulation (loft / cavity)?',
        type: 'options',
        options: ['FULL', 'PARTIAL', 'NONE', 'UNKNOWN'],
      },
      {
        id: 'glazing_type',
        label: 'Double or triple glazed?',
        type: 'options',
        options: ['TRIPLE', 'DOUBLE', 'SINGLE', 'UNKNOWN'],
      },
    ],
  },
  grants: {
    id: 'grants',
    name: 'grants',
    questions: [
      {
        id: 'boiler_age',
        label: 'Is your boiler over 10 years old?',
        type: 'options',
        options: ['OVER_10YR', 'UNDER_10YR', 'UNKNOWN'],
      },
      {
        id: 'income_benefits',
        label: 'Are you on any income-related benefits?',
        type: 'options',
        options: ['YES', 'NO', 'PREFER_NOT'],
      },
      {
        id: 'prior_eco_bus',
        label: 'Have you had previous ECO4 or BUS grants?',
        type: 'options',
        options: ['YES', 'NO', 'UNSURE'],
      },
    ],
  },
  solar: {
    id: 'solar',
    name: 'solar',
    questions: [
      {
        id: 'roof_orientation',
        label: 'Roof pitch orientation (S / E / W)?',
        type: 'options',
        options: ['SOUTH', 'EAST', 'WEST', 'MIXED', 'FLAT'],
      },
      {
        id: 'roof_shading',
        label: 'Do you have a chimney or significant shading?',
        type: 'options',
        options: ['NONE', 'CHIMNEY', 'TREES', 'BOTH'],
      },
      {
        id: 'daytime_occupancy',
        label: 'Average daytime occupancy at home?',
        type: 'options',
        options: ['HIGH', 'MEDIUM', 'LOW', 'OUT_MOST_DAYS'],
      },
    ],
  },
  travel: {
    id: 'travel',
    name: 'travel',
    questions: [
      {
        id: 'commute_distance',
        label: 'Daily commute distance (miles)?',
        type: 'number',
        repeatLabel: 'Even a rough estimate helps — miles per day?',
      },
      {
        id: 'ev_hybrid',
        label: 'Do you own an EV or hybrid?',
        type: 'options',
        options: ['EV', 'HYBRID', 'PETROL_DIESEL', 'NONE'],
      },
      {
        id: 'public_transport',
        label: 'Public transport access near you?',
        type: 'options',
        options: ['EXCELLENT', 'LIMITED', 'NONE'],
      },
    ],
  },
  holidays: {
    id: 'holidays',
    name: 'holidays',
    questions: [
      {
        id: 'annual_flights',
        label: 'Annual flight count?',
        type: 'options',
        options: ['NONE', 'ONE_TWO', 'THREE_PLUS'],
      },
      {
        id: 'flight_duration',
        label: 'Average flight duration (hours)?',
        type: 'options',
        options: ['SHORT', 'MEDIUM', 'LONG_HAUL'],
      },
      {
        id: 'carbon_offsets',
        label: 'Do you buy carbon offsets?',
        type: 'options',
        options: ['YES', 'NO', 'SOMETIMES'],
      },
    ],
  },
  food: {
    id: 'food',
    name: 'food',
    questions: [
      {
        id: 'diet_profile',
        label: 'Meat-heavy or plant-based?',
        type: 'options',
        options: ['MEAT_HEAVY', 'FLEXI', 'PLANT_BASED'],
      },
      {
        id: 'organic_shopping',
        label: 'Percentage of organic shopping?',
        type: 'options',
        options: ['HIGH', 'SOME', 'RARELY', 'NEVER'],
      },
      {
        id: 'own_produce',
        label: 'Do you grow any of your own produce?',
        type: 'options',
        options: ['YES', 'NO', 'STARTING'],
      },
    ],
  },
  shopping: {
    id: 'shopping',
    name: 'shopping',
    questions: [
      {
        id: 'retail_channel',
        label: 'High-street or second-hand first?',
        type: 'options',
        options: ['HIGH_STREET', 'SECOND_HAND', 'MIXED'],
      },
      {
        id: 'repair_mindset',
        label: 'Repair vs replace mindset?',
        type: 'options',
        options: ['REPAIR_FIRST', 'REPLACE', 'MIXED'],
      },
      {
        id: 'online_deliveries',
        label: 'Frequency of online deliveries?',
        type: 'options',
        options: ['DAILY', 'WEEKLY', 'MONTHLY', 'RARELY'],
      },
    ],
  },
  money: {
    id: 'money',
    name: 'money',
    questions: [
      {
        id: 'monthly_energy_bill',
        label: 'Monthly energy bill (£)?',
        type: 'number',
        repeatLabel: 'Rough figure is fine — what do you pay per month?',
      },
      {
        id: 'tariff_type',
        label: 'Fixed or variable tariff?',
        type: 'options',
        options: ['FIXED', 'VARIABLE', 'UNKNOWN'],
      },
      {
        id: 'green_investments',
        label: 'Interest in green investments?',
        type: 'options',
        options: ['HIGH', 'SOME', 'NONE'],
      },
    ],
  },
  tech: {
    id: 'tech',
    name: 'tech',
    questions: [
      {
        id: 'smart_thermostat',
        label: 'Smart thermostat (Nest / Hive)?',
        type: 'options',
        options: ['YES', 'NO', 'PLANNED'],
      },
      {
        id: 'smart_home',
        label: 'Home Assistant or smart plugs?',
        type: 'options',
        options: ['YES', 'NO', 'PARTIAL'],
      },
      {
        id: 'smart_meter',
        label: 'Smart meter installed?',
        type: 'options',
        options: ['YES', 'NO', 'UNKNOWN'],
      },
    ],
  },
  water: {
    id: 'water',
    name: 'water',
    questions: [
      {
        id: 'garden_butt',
        label: 'Garden size suitable for water butts?',
        type: 'options',
        options: ['LARGE', 'SMALL', 'NONE'],
      },
      {
        id: 'wash_preference',
        label: 'Shower or bath preference?',
        type: 'options',
        options: ['SHOWER', 'BATH', 'BOTH'],
      },
      {
        id: 'rainwater_harvest',
        label: 'Rainwater harvesting setup?',
        type: 'options',
        options: ['YES', 'NO', 'PLANNED'],
      },
    ],
  },
  waste: {
    id: 'waste',
    name: 'waste',
    questions: [
      {
        id: 'food_waste_collection',
        label: 'Access to food waste collection?',
        type: 'options',
        options: ['YES', 'NO', 'PARTIAL'],
      },
      {
        id: 'composting',
        label: 'Composting on-site?',
        type: 'options',
        options: ['YES', 'NO', 'SHARED'],
      },
      {
        id: 'soft_plastics',
        label: 'Soft plastic recycling habit?',
        type: 'options',
        options: ['ALWAYS', 'SOMETIMES', 'NEVER'],
      },
    ],
  },
  carbon: {
    id: 'carbon',
    name: 'carbon',
    questions: [
      {
        id: 'footprint_awareness',
        label: 'Are you aware of your total footprint?',
        type: 'options',
        options: ['YES', 'ROUGH', 'NO'],
      },
      {
        id: 'carbon_removal',
        label: 'Interest in carbon removal?',
        type: 'options',
        options: ['HIGH', 'SOME', 'NONE'],
      },
      {
        id: 'tonne_reduction_timeline',
        label: 'Timeline for 1t reduction?',
        type: 'options',
        options: ['THIS_YEAR', 'ONE_TO_THREE', 'LONGER'],
      },
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
  grants: 'Grants',
  solar: 'Solar',
  travel: 'Travel',
  holidays: 'Holidays',
  food: 'Food',
  shopping: 'Shopping',
  money: 'Money',
  tech: 'Tech',
  water: 'Water',
  waste: 'Waste',
  carbon: 'Carbon',
}

export const JOURNEY_COLORS: Record<JourneyId, string> = {
  home: 'var(--color-j-home)',
  grants: 'var(--color-j-grants)',
  solar: 'var(--color-j-solar)',
  travel: 'var(--color-j-travel)',
  holidays: 'var(--color-j-holidays)',
  food: 'var(--color-j-food)',
  shopping: 'var(--color-j-shopping)',
  money: 'var(--color-j-money)',
  tech: 'var(--color-j-tech)',
  water: 'var(--color-j-water)',
  waste: 'var(--color-j-waste)',
  carbon: 'var(--color-j-carbon)',
}

export const FUNKY_QUESTION_LABEL: Record<string, string> = {
  home: JOURNEYS.home.questions[0].label,
  grants: JOURNEYS.grants.questions[0].label,
  solar: JOURNEYS.solar.questions[0].label,
  travel: JOURNEYS.travel.questions[0].label,
  holidays: JOURNEYS.holidays.questions[0].label,
  food: JOURNEYS.food.questions[0].label,
  shopping: JOURNEYS.shopping.questions[0].label,
  money: JOURNEYS.money.questions[0].label,
  tech: JOURNEYS.tech.questions[0].label,
  water: JOURNEYS.water.questions[0].label,
  waste: JOURNEYS.waste.questions[0].label,
  carbon: JOURNEYS.carbon.questions[0].label,
}

const FUNKY_OPTION_DISPLAY: Record<string, string> = {
  DETACHED: 'DET',
  SEMI: 'SEMI',
  TERRACED: 'TER',
  FLAT: 'FLAT',
  FULL: 'FULL',
  PARTIAL: 'PART',
  NONE: 'NONE',
  UNKNOWN: '?',
  TRIPLE: '3X',
  DOUBLE: '2X',
  SINGLE: '1X',
  OVER_10YR: '10+',
  UNDER_10YR: '<10',
  PREFER_NOT: '—',
  UNSURE: '?',
  SOUTH: 'S',
  EAST: 'E',
  WEST: 'W',
  MIXED: 'MIX',
  CHIMNEY: 'CHIM',
  TREES: 'TREE',
  BOTH: 'BOTH',
  HIGH: 'HI',
  MEDIUM: 'MID',
  LOW: 'LOW',
  OUT_MOST_DAYS: 'OUT',
  EV: 'EV',
  HYBRID: 'HYB',
  PETROL_DIESEL: 'ICE',
  EXCELLENT: 'GOOD',
  LIMITED: 'LIM',
  ONE_TWO: '1-2',
  THREE_PLUS: '3+',
  SHORT: 'SHRT',
  LONG_HAUL: 'LONG',
  SOMETIMES: 'SOME',
  MEAT_HEAVY: 'MEAT',
  FLEXI: 'FLEX',
  PLANT_BASED: 'PLANT',
  RARELY: 'RARE',
  NEVER: 'NEVER',
  STARTING: 'NEW',
  HIGH_STREET: 'SHOP',
  SECOND_HAND: '2ND',
  REPAIR_FIRST: 'FIX',
  REPLACE: 'NEW',
  DAILY: 'DAY',
  WEEKLY: 'WK',
  MONTHLY: 'MO',
  FIXED: 'FIX',
  VARIABLE: 'VAR',
  PLANNED: 'PLAN',
  LARGE: 'BIG',
  SMALL: 'SML',
  SHOWER: 'SHOW',
  BATH: 'BATH',
  SHARED: 'SHR',
  ALWAYS: 'ALL',
  ROUGH: 'RGH',
  THIS_YEAR: 'NOW',
  ONE_TO_THREE: '1-3Y',
  LONGER: '3Y+',
  YES: 'YES',
  NO: 'NO',
}

export function getFunkyOptionDisplay(opt: string): string {
  return FUNKY_OPTION_DISPLAY[opt] ?? (opt.length > 5 ? opt.slice(0, 5) : opt)
}

export const OPTION_FULL_LABELS: Record<string, string> = {
  ...FUNKY_OPTION_DISPLAY,
  DETACHED: 'Detached',
  SEMI: 'Semi',
  TERRACED: 'Terraced',
  OVER_10YR: 'Over 10yr',
  UNDER_10YR: 'Under 10yr',
  PLANT_BASED: 'Plant',
  MEAT_HEAVY: 'Meat heavy',
  HIGH_STREET: 'High street',
  SECOND_HAND: 'Second hand',
  REPAIR_FIRST: 'Repair first',
  OUT_MOST_DAYS: 'Out most days',
  LONG_HAUL: 'Long haul',
  ONE_TO_THREE: '1–3 years',
  THIS_YEAR: 'This year',
}

export function getOptionFullLabel(opt: string): string {
  if (OPTION_FULL_LABELS[opt]) return OPTION_FULL_LABELS[opt]
  return opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isValidJourneyId(id: string): id is JourneyId {
  return JOURNEY_IDS.includes(id as JourneyId)
}

export function isValidJourneyQuestion(journeyId: string, questionId: string): boolean {
  if (!isValidJourneyId(journeyId)) return false
  const def = JOURNEYS[journeyId as JourneyId]
  return def?.questions?.some((q) => q.id === questionId) ?? false
}

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
