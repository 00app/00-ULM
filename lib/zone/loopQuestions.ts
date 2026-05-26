import type { JourneyId } from '@/lib/journeys'
import {
  JOURNEY_IDS,
  JOURNEY_ORDER,
  getFunkyOptionDisplay,
  isValidJourneyId,
  isValidJourneyQuestion,
} from '@/lib/journeys'
import { hasLoopDoneForJourney, readAnsweredLoopQuestionIds } from '@/lib/zone/loopMemory'
import { safeGetItem } from '@/lib/zone/safeProfileStorage'

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
  /** Journeys that may surface this beat after Solo Focus close. Empty = any journey. */
  journeyKeys: JourneyId[]
}

/** Canonical loop bank — each questionId is shown at most once per browser profile. */
export const LOOP_QUESTION_BANK: LoopQuestionBeat[] = [
  {
    questionId: 'lifestyle_shift_pattern',
    question: 'swap your annual\nflight for rail?',
    journeyKeys: [],
    options: [
      { label: 'YES', value: 'YES — RAIL & LOCAL', ariaLabel: 'Yes — rail and local' },
      { label: 'SHOW', value: 'MAYBE — SHOW ME', ariaLabel: 'Show me the maths' },
      { label: 'FLY', value: 'NO — KEEP FLYING', ariaLabel: 'Keep flying' },
    ],
  },
  {
    questionId: 'travel_rail_vs_flight',
    question: 'rail instead\nof flying?',
    journeyKeys: ['travel'],
    options: [
      { label: 'YES', value: 'YES — RAIL', ariaLabel: 'Yes — rail' },
      { label: 'MATH', value: 'SHOW ME THE MATH', ariaLabel: 'Show me the maths' },
      { label: 'FLY', value: 'KEEP FLYING', ariaLabel: 'Keep flying' },
    ],
  },
  {
    questionId: 'travel_ev_commute',
    question: 'ev for your\ncommute?',
    journeyKeys: ['travel', 'money'],
    options: [
      { label: 'YES', value: 'YES — EV', ariaLabel: 'Yes — electric vehicle' },
      { label: 'COMPARE', value: 'COMPARE COSTS', ariaLabel: 'Compare costs' },
      { label: 'NO', value: 'KEEP PETROL', ariaLabel: 'Keep current car' },
    ],
  },
  {
    questionId: 'holidays_local_vs_longhaul',
    question: 'uk staycations\nnot long-haul?',
    journeyKeys: ['holidays'],
    options: [
      { label: 'YES', value: 'YES — LOCAL', ariaLabel: 'Yes — local holidays' },
      { label: 'MAYBE', value: 'MAYBE', ariaLabel: 'Maybe' },
      { label: 'LONG', value: 'KEEP LONG-HAUL', ariaLabel: 'Keep long-haul' },
    ],
  },
  {
    questionId: 'holidays_train_not_plane',
    question: 'train to europe\nnot short flights?',
    journeyKeys: ['holidays', 'travel'],
    options: [
      { label: 'YES', value: 'YES — TRAIN', ariaLabel: 'Yes — train' },
      { label: 'SHOW', value: 'SHOW ROUTES', ariaLabel: 'Show routes' },
      { label: 'FLY', value: 'KEEP FLYING', ariaLabel: 'Keep flying' },
    ],
  },
  {
    questionId: 'food_plant_shift',
    question: 'two plant-based\nmeals a week?',
    journeyKeys: ['food'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TRY', value: 'TRY IT', ariaLabel: 'Try it' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'food_waste_cut',
    question: 'cut food waste\nby half?',
    journeyKeys: ['food', 'waste'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TIPS', value: 'SHOW TIPS', ariaLabel: 'Show tips' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'money_ev_swap',
    question: 'swap petrol\nfor an ev?',
    journeyKeys: ['money'],
    options: [
      { label: 'YES', value: 'YES — EV', ariaLabel: 'Yes — electric vehicle' },
      { label: 'COMPARE', value: 'COMPARE COSTS', ariaLabel: 'Compare costs' },
      { label: 'PETROL', value: 'KEEP PETROL', ariaLabel: 'Keep petrol' },
    ],
  },
  {
    questionId: 'money_smart_tariff',
    question: 'switch to a\nsmart tariff?',
    journeyKeys: ['money', 'home'],
    options: [
      { label: 'YES', value: 'YES — SWITCH', ariaLabel: 'Yes — switch' },
      { label: 'COMPARE', value: 'COMPARE', ariaLabel: 'Compare tariffs' },
      { label: 'NO', value: 'STAY PUT', ariaLabel: 'Stay on current tariff' },
    ],
  },
  {
    questionId: 'utilities_supplier_switch',
    question: 'switch gas or\nelectric supplier?',
    journeyKeys: ['utilities', 'money', 'home'],
    options: [
      { label: 'YES', value: 'YES — SWITCH', ariaLabel: 'Yes — switch supplier' },
      { label: 'COMPARE', value: 'COMPARE', ariaLabel: 'Compare tariffs' },
      { label: 'NO', value: 'STAY PUT', ariaLabel: 'Stay on current supplier' },
    ],
  },
  {
    questionId: 'home_heat_pump',
    question: 'heat pump\nnot gas?',
    journeyKeys: ['home'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes — heat pump' },
      { label: 'CHECK', value: 'CHECK ELIGIBILITY', ariaLabel: 'Check eligibility' },
      { label: 'GAS', value: 'STAY ON GAS', ariaLabel: 'Stay on gas' },
    ],
  },
  {
    questionId: 'home_loft_insulate',
    question: 'loft insulation\nthis year?',
    journeyKeys: ['home', 'grants'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'QUOTE', value: 'GET QUOTE', ariaLabel: 'Get quote' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'grants_bus_boiler',
    question: 'check bus grant\nfor your boiler?',
    journeyKeys: ['grants', 'home'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'INFO', value: 'MORE INFO', ariaLabel: 'More info' },
      { label: 'NO', value: 'NOT ELIGIBLE', ariaLabel: 'Not eligible' },
    ],
  },
  {
    questionId: 'solar_roof_fit',
    question: 'solar on your\nroof?',
    journeyKeys: ['solar', 'home'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'SURVEY', value: 'FREE SURVEY', ariaLabel: 'Free survey' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'shopping_repair_first',
    question: 'repair before\nyou replace?',
    journeyKeys: ['shopping'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'SHOW', value: 'SHOW LOCAL', ariaLabel: 'Show local repair' },
      { label: 'NO', value: 'BUY NEW', ariaLabel: 'Buy new' },
    ],
  },
  {
    questionId: 'tech_standby_off',
    question: 'kill standby\nat night?',
    journeyKeys: ['tech'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'HOW', value: 'SHOW HOW', ariaLabel: 'Show how' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'water_meter_save',
    question: 'water meter\nsave water?',
    journeyKeys: ['water'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'CHECK', value: 'CHECK', ariaLabel: 'Check' },
      { label: 'NO', value: 'NO METER', ariaLabel: 'No meter' },
    ],
  },
  {
    questionId: 'waste_compost',
    question: 'compost food\nscraps?',
    journeyKeys: ['waste', 'food'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TRY', value: 'TRY IT', ariaLabel: 'Try it' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'carbon_offset_cut',
    question: 'cut direct\nemissions first?',
    journeyKeys: ['carbon'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'PLAN', value: 'SHOW PLAN', ariaLabel: 'Show plan' },
      { label: 'OFFSET', value: 'OFFSET ONLY', ariaLabel: 'Offset only' },
    ],
  },
]

const LOOP_QUESTION_IDS = new Set(LOOP_QUESTION_BANK.map((b) => b.questionId))

export function isLoopQuestionId(questionId: string): boolean {
  return LOOP_QUESTION_IDS.has(questionId.trim())
}

export function isValidLoopOrJourneyQuestion(journeyId: string, questionId: string): boolean {
  return (
    isValidJourneyQuestion(journeyId, questionId) ||
    (isValidJourneyId(journeyId) && isLoopQuestionId(questionId))
  )
}

export function beatsForJourney(journeyId: JourneyId): LoopQuestionBeat[] {
  return LOOP_QUESTION_BANK.filter(
    (b) => b.journeyKeys.length === 0 || b.journeyKeys.includes(journeyId)
  )
}

/** Next unanswered loop beat for this journey — one lifestyle beat per category, journey-scoped first. */
export function pickNextLoopQuestion(journeyId: JourneyId): LoopQuestionBeat | null {
  if (hasLoopDoneForJourney(journeyId)) return null
  const answered = readAnsweredLoopQuestionIds()
  const scoped = LOOP_QUESTION_BANK.filter(
    (b) => b.journeyKeys.includes(journeyId) && !answered.has(b.questionId)
  )
  if (scoped.length > 0) return scoped[0]!
  return null
}

/** @deprecated Use pickNextLoopQuestion — kept for callers that have not migrated. */
export function pickLoopQuestionForJourney(journeyId: JourneyId | null | undefined): LoopQuestionBeat {
  const jid = journeyId && JOURNEY_IDS.includes(journeyId) ? journeyId : 'travel'
  return pickNextLoopQuestion(jid) ?? LOOP_QUESTION_BANK[0]!
}

export function loopQuestionsAnsweredCount(): number {
  return readAnsweredLoopQuestionIds().size
}

export type LoopAnswerSettingsRow = {
  questionId: string
  question: string
  answer: string
  journeyId?: JourneyId
}

function loopQuestionLabel(beat: LoopQuestionBeat): string {
  const q = beat.question.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  if (!q) return beat.questionId.replace(/_/g, ' ')
  return q.charAt(0).toUpperCase() + q.slice(1)
}

function loopAnswerDisplay(beat: LoopQuestionBeat, raw: string): string {
  const t = raw.trim()
  const hit = beat.options.find((o) => o.value === t)
  if (hit) return hit.label
  return getFunkyOptionDisplay(t) || t
}

export function getLoopBeatByQuestionId(questionId: string): LoopQuestionBeat | null {
  const qid = questionId.trim()
  if (!qid) return null
  return LOOP_QUESTION_BANK.find((b) => b.questionId === qid) ?? null
}

/** Answered loop beats for Settings bento grid (`zz_loop_answers_log` + journey_* loop ids). */
export function readLoopAnswersForSettings(): LoopAnswerSettingsRow[] {
  if (typeof window === 'undefined') return []
  const bankById = new Map(LOOP_QUESTION_BANK.map((b) => [b.questionId, b]))
  const rows: LoopAnswerSettingsRow[] = []
  const seen = new Set<string>()

  const push = (questionId: string, answer: string, journeyId?: JourneyId) => {
    const qid = questionId.trim()
    const a = answer.trim()
    if (!qid || !a || seen.has(qid)) return
    const beat = bankById.get(qid)
    if (!beat) return
    seen.add(qid)
    rows.push({
      questionId: qid,
      question: loopQuestionLabel(beat),
      answer: loopAnswerDisplay(beat, a),
      journeyId,
    })
  }

  try {
    const logRaw = safeGetItem('zz_loop_answers_log')
    const log = logRaw ? (JSON.parse(logRaw) as Record<string, string>) : {}
    for (const [compound, answer] of Object.entries(log)) {
      if (typeof answer !== 'string') continue
      const sep = compound.indexOf('::')
      if (sep < 0) continue
      const jid = compound.slice(0, sep)
      const qid = compound.slice(sep + 2)
      push(qid, answer, isValidJourneyId(jid) ? jid : undefined)
    }
  } catch {
    /* ignore */
  }

  for (const jid of JOURNEY_ORDER) {
    try {
      const raw = safeGetItem(`journey_${jid}_answers`)
      if (!raw) continue
      const map = JSON.parse(raw) as Record<string, string>
      for (const [qid, answer] of Object.entries(map)) {
        if (!isLoopQuestionId(qid) || typeof answer !== 'string') continue
        push(qid, answer, jid)
      }
    } catch {
      /* ignore */
    }
  }

  const order = new Map(LOOP_QUESTION_BANK.map((b, i) => [b.questionId, i]))
  rows.sort((a, b) => (order.get(a.questionId) ?? 999) - (order.get(b.questionId) ?? 999))
  return rows
}
