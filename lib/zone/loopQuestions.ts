import type { JourneyId } from '@/lib/journeys'

export type LoopQuestionOption = {
  label: string
  value: string
  ariaLabel?: string
}

export type LoopQuestionBeat = {
  questionId: string
  /** Profile-style lowercase prompt (short; may use \\n for line break). */
  question: string
  options: LoopQuestionOption[]
}

const DEFAULT_LOOP: LoopQuestionBeat = {
  questionId: 'lifestyle_shift_pattern',
  question: 'swap your annual\nflight for rail?',
  options: [
    { label: 'YES', value: 'YES — RAIL & LOCAL', ariaLabel: 'Yes — rail and local' },
    { label: 'SHOW', value: 'MAYBE — SHOW ME', ariaLabel: 'Show me the maths' },
    { label: 'FLY', value: 'NO — KEEP FLYING', ariaLabel: 'Keep flying' },
  ],
}

const BY_JOURNEY: Partial<Record<JourneyId, LoopQuestionBeat>> = {
  travel: {
    questionId: 'travel_rail_vs_flight',
    question: 'rail instead\nof flying?',
    options: [
      { label: 'YES', value: 'YES — RAIL', ariaLabel: 'Yes — rail' },
      { label: 'MATH', value: 'SHOW ME THE MATH', ariaLabel: 'Show me the maths' },
      { label: 'FLY', value: 'KEEP FLYING', ariaLabel: 'Keep flying' },
    ],
  },
  holidays: {
    questionId: 'holidays_local_vs_longhaul',
    question: 'uk staycations\nnot long-haul?',
    options: [
      { label: 'YES', value: 'YES — LOCAL', ariaLabel: 'Yes — local holidays' },
      { label: 'MAYBE', value: 'MAYBE', ariaLabel: 'Maybe' },
      { label: 'LONG', value: 'KEEP LONG-HAUL', ariaLabel: 'Keep long-haul' },
    ],
  },
  food: {
    questionId: 'food_plant_shift',
    question: 'two plant-based\nmeals a week?',
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TRY', value: 'TRY IT', ariaLabel: 'Try it' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  money: {
    questionId: 'money_ev_swap',
    question: 'swap petrol\nfor an ev?',
    options: [
      { label: 'YES', value: 'YES — EV', ariaLabel: 'Yes — electric vehicle' },
      { label: 'COMPARE', value: 'COMPARE COSTS', ariaLabel: 'Compare costs' },
      { label: 'PETROL', value: 'KEEP PETROL', ariaLabel: 'Keep petrol' },
    ],
  },
  home: {
    questionId: 'home_heat_pump',
    question: 'heat pump\nnot gas?',
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes — heat pump' },
      { label: 'CHECK', value: 'CHECK ELIGIBILITY', ariaLabel: 'Check eligibility' },
      { label: 'GAS', value: 'STAY ON GAS', ariaLabel: 'Stay on gas' },
    ],
  },
}

export function pickLoopQuestionForJourney(journeyId: JourneyId | null | undefined): LoopQuestionBeat {
  if (journeyId && BY_JOURNEY[journeyId]) return BY_JOURNEY[journeyId]!
  return DEFAULT_LOOP
}
