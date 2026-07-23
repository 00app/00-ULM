import type { JourneyId } from '@/lib/journeys'
import {
  JOURNEY_IDS,
  JOURNEY_ORDER,
  getOptionFullLabel,
  isValidJourneyId,
  isValidJourneyQuestion,
} from '@/lib/journeys'
import { humanizeZoneHeadline } from '@/lib/zone/plainEnglishCopy'
import { hasLoopDoneForJourney, readAnsweredLoopQuestionIds } from '@/lib/zone/loopMemory'
import { safeGetItem } from '@/lib/zone/safeProfileStorage'
import {
  normalizeProfileGoalValue,
  type ProfileGoalValue,
} from '@/lib/profile/goalWeighting'
import type { AffluenceAuditMode } from '@/lib/zone/affluenceCheck'
import { readProfileSegmentContext } from '@/lib/profile/profileGoalPreference'
import { profileFieldsFromStorage } from '@/lib/profile/onboardingComplete'

export type LoopGoalLean = 'money' | 'carbon' | 'neutral'

export type LoopPickContext = {
  goal?: ProfileGoalValue
  toneMode?: AffluenceAuditMode
  /** Override for the profile home-type gate below — falls back to localStorage when omitted. */
  homeType?: string | null
}

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
  /** Single journey lane — one category only (Director's order). */
  journeyKeys: [JourneyId]
  /**
   * Profile gate — same shape/semantics as RockHabit.applicable (lib/rock/types.ts): the beat
   * only shows to users whose profile matches at least one listed value per dimension. Omitting
   * a key means no restriction on that dimension; missing profile data never excludes (soft gate).
   */
  applicable?: {
    home_type?: string[]
  }
}

/** Canonical loop bank — each questionId is shown at most once per browser profile. Plain English only (no BUS, ECO4, MCS). */
export const LOOP_QUESTION_BANK: LoopQuestionBeat[] = [
  {
    questionId: 'travel_rail_vs_flight',
    question: 'take the train\ninstead of flying?',
    journeyKeys: ['travel'],
    options: [
      { label: 'YES', value: 'YES — RAIL', ariaLabel: 'Yes — take the train' },
      { label: 'MATH', value: 'SHOW ME THE MATH', ariaLabel: 'Show me the savings' },
      { label: 'FLY', value: 'KEEP FLYING', ariaLabel: 'Keep flying' },
    ],
  },
  {
    questionId: 'travel_ev_commute',
    question: 'try an electric car\nfor your commute?',
    journeyKeys: ['travel'],
    options: [
      { label: 'YES', value: 'YES — EV', ariaLabel: 'Yes — electric car' },
      { label: 'COMPARE', value: 'COMPARE COSTS', ariaLabel: 'Compare costs' },
      { label: 'NO', value: 'KEEP PETROL', ariaLabel: 'Keep my current car' },
    ],
  },
  {
    questionId: 'holidays_local_vs_longhaul',
    question: 'holiday in the uk\nnot long flights?',
    journeyKeys: ['holidays'],
    options: [
      { label: 'YES', value: 'YES — LOCAL', ariaLabel: 'Yes — stay in the UK' },
      { label: 'MAYBE', value: 'MAYBE', ariaLabel: 'Maybe' },
      { label: 'LONG', value: 'KEEP LONG-HAUL', ariaLabel: 'Keep long-haul trips' },
    ],
  },
  {
    questionId: 'holidays_train_not_plane',
    question: 'train to europe\nnot short flights?',
    journeyKeys: ['holidays'],
    options: [
      { label: 'YES', value: 'YES — TRAIN', ariaLabel: 'Yes — take the train' },
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
    question: 'cut food waste\nat home?',
    journeyKeys: ['waste'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TIPS', value: 'SHOW TIPS', ariaLabel: 'Show tips' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'money_ev_swap',
    question: 'switch to electric\nnot petrol?',
    journeyKeys: ['money'],
    options: [
      { label: 'YES', value: 'YES — EV', ariaLabel: 'Yes — electric car' },
      { label: 'COMPARE', value: 'COMPARE COSTS', ariaLabel: 'Compare costs' },
      { label: 'PETROL', value: 'KEEP PETROL', ariaLabel: 'Keep petrol' },
    ],
  },
  {
    questionId: 'money_smart_tariff',
    question: 'try a cheaper\nenergy tariff?',
    journeyKeys: ['money'],
    options: [
      { label: 'YES', value: 'YES — SWITCH', ariaLabel: 'Yes — switch tariff' },
      { label: 'COMPARE', value: 'COMPARE', ariaLabel: 'Compare tariffs' },
      { label: 'NO', value: 'STAY PUT', ariaLabel: 'Stay on current tariff' },
    ],
  },
  {
    questionId: 'utilities_supplier_switch',
    question: 'switch gas or\nelectric supplier?',
    journeyKeys: ['utilities'],
    options: [
      { label: 'YES', value: 'YES — SWITCH', ariaLabel: 'Yes — switch supplier' },
      { label: 'COMPARE', value: 'COMPARE', ariaLabel: 'Compare tariffs' },
      { label: 'NO', value: 'STAY PUT', ariaLabel: 'Stay on current supplier' },
    ],
  },
  {
    questionId: 'home_heat_pump',
    question: 'heat pump instead\nof gas boiler?',
    journeyKeys: ['home'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes — heat pump' },
      { label: 'CHECK', value: 'CHECK ELIGIBILITY', ariaLabel: 'Check if I qualify' },
      { label: 'GAS', value: 'STAY ON GAS', ariaLabel: 'Stay on gas' },
    ],
  },
  {
    questionId: 'home_loft_insulate',
    question: 'loft insulation\nthis year?',
    journeyKeys: ['home'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'QUOTE', value: 'GET QUOTE', ariaLabel: 'Get a quote' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
    // Most UK flats have no loft — matches the same gate already used for this identical topic
    // in the Rock/Today's Tips catalog (habitsCatalog.ts: loft-hatch-seal, loft-top-up).
    applicable: { home_type: ['HOUSE'] },
  },
  {
    questionId: 'solar_roof_fit',
    question: 'solar panels\non your roof?',
    journeyKeys: ['solar'],
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
      { label: 'SHOW', value: 'SHOW LOCAL', ariaLabel: 'Show local repair shops' },
      { label: 'NO', value: 'BUY NEW', ariaLabel: 'Buy new' },
    ],
  },
  {
    questionId: 'tech_standby_off',
    question: 'turn off standby\nat night?',
    journeyKeys: ['tech'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'HOW', value: 'SHOW HOW', ariaLabel: 'Show me how' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'water_meter_save',
    question: 'use less water\non your meter?',
    journeyKeys: ['water'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'CHECK', value: 'CHECK', ariaLabel: 'Check my options' },
      { label: 'NO', value: 'NO METER', ariaLabel: 'No water meter' },
    ],
  },
  {
    questionId: 'waste_compost',
    question: 'compost food\nscraps at home?',
    journeyKeys: ['waste'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'TRY', value: 'TRY IT', ariaLabel: 'Try it' },
      { label: 'NO', value: 'NOT YET', ariaLabel: 'Not yet' },
    ],
  },
  {
    questionId: 'carbon_offset_cut',
    question: 'cut home energy first\nnot just offsets?',
    journeyKeys: ['carbon'],
    options: [
      { label: 'YES', value: 'YES', ariaLabel: 'Yes' },
      { label: 'PLAN', value: 'SHOW PLAN', ariaLabel: 'Show me a plan' },
      { label: 'OFFSET', value: 'OFFSET ONLY', ariaLabel: 'Offsets only' },
    ],
  },
]

/** Goal lean per beat — used for ranking, not filtering (carbon beats still surface for money-first users). */
const LOOP_BEAT_GOAL_LEAN: Record<string, LoopGoalLean> = {
  travel_rail_vs_flight: 'carbon',
  travel_ev_commute: 'carbon',
  holidays_local_vs_longhaul: 'carbon',
  holidays_train_not_plane: 'carbon',
  food_plant_shift: 'carbon',
  food_waste_cut: 'neutral',
  money_ev_swap: 'money',
  money_smart_tariff: 'money',
  utilities_supplier_switch: 'money',
  home_heat_pump: 'neutral',
  home_loft_insulate: 'money',
  solar_roof_fit: 'money',
  shopping_repair_first: 'carbon',
  tech_standby_off: 'money',
  water_meter_save: 'money',
  waste_compost: 'carbon',
  carbon_offset_cut: 'carbon',
}

function loopBeatGoalLean(beat: LoopQuestionBeat): LoopGoalLean {
  return LOOP_BEAT_GOAL_LEAN[beat.questionId] ?? 'neutral'
}

function loopBeatHasMathOption(beat: LoopQuestionBeat): boolean {
  return beat.options.some((o) => /MATH|COMPARE|COSTS/i.test(o.value))
}

/** Higher score = better match for this user's goal segment. Carbon beats still score >0 for money users. */
export function scoreLoopBeatForProfile(
  beat: LoopQuestionBeat,
  goal: ProfileGoalValue,
  toneMode?: AffluenceAuditMode
): number {
  const lean = loopBeatGoalLean(beat)
  let score = 0

  if (goal === 'money') {
    if (lean === 'money') score += 32
    else if (lean === 'neutral') score += 22
    else score += 12
    if (loopBeatHasMathOption(beat)) score += 6
  } else if (goal === 'carbon') {
    if (lean === 'carbon') score += 32
    else if (lean === 'neutral') score += 22
    else score += 12
  } else {
    if (lean === 'neutral') score += 28
    else score += 24
  }

  if (toneMode === 'asset_optimization') {
    if (beat.questionId.includes('solar') || beat.questionId.includes('smart_tariff')) score += 10
  } else if (toneMode === 'bill_survival') {
    if (beat.questionId.includes('tariff')) score += 8
  }

  return score
}

const LOOP_BANK_INDEX = new Map(LOOP_QUESTION_BANK.map((b, i) => [b.questionId, i]))

export function resolveLoopPickContext(
  ctx?: LoopPickContext
): Required<Pick<LoopPickContext, 'goal' | 'toneMode'>> {
  if (ctx?.goal) {
    return {
      goal: normalizeProfileGoalValue(ctx.goal),
      toneMode: ctx.toneMode ?? readProfileSegmentContext().toneMode,
    }
  }
  if (typeof window !== 'undefined') {
    const seg = readProfileSegmentContext()
    return { goal: seg.goal, toneMode: ctx?.toneMode ?? seg.toneMode }
  }
  return { goal: 'balanced', toneMode: 'bill_survival' }
}

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
  return LOOP_QUESTION_BANK.filter((b) => b.journeyKeys[0] === journeyId)
}

/** Resolve the home-type gate value — explicit ctx wins, else localStorage (client only). */
function resolveHomeTypeForGate(ctx?: LoopPickContext): string | null {
  if (ctx?.homeType !== undefined) return ctx.homeType
  if (typeof window === 'undefined') return null
  return profileFieldsFromStorage().homeType?.trim() || null
}

/** Return false only when we are confident the beat is irrelevant for this profile — same soft-gate
 *  semantics as habitMatchesProfile (filterRockHabits.ts): missing profile data never excludes. */
function beatMatchesHomeType(beat: LoopQuestionBeat, homeType: string | null): boolean {
  const gate = beat.applicable?.home_type
  if (!gate || !homeType) return true
  return gate.includes(homeType)
}

/** Next unanswered loop beat — ranked by profile goal + tone; still one journey lane. */
export function pickNextLoopQuestion(
  journeyId: JourneyId,
  ctx?: LoopPickContext
): LoopQuestionBeat | null {
  if (hasLoopDoneForJourney(journeyId)) return null
  const answered = readAnsweredLoopQuestionIds()
  const segment = resolveLoopPickContext(ctx)
  const homeType = resolveHomeTypeForGate(ctx)
  const candidates = LOOP_QUESTION_BANK.filter(
    (beat) =>
      beat.journeyKeys[0] === journeyId &&
      !answered.has(beat.questionId) &&
      beatMatchesHomeType(beat, homeType)
  )
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]!

  return [...candidates].sort((a, b) => {
    const scoreDiff =
      scoreLoopBeatForProfile(b, segment.goal, segment.toneMode) -
      scoreLoopBeatForProfile(a, segment.goal, segment.toneMode)
    if (scoreDiff !== 0) return scoreDiff
    return (LOOP_BANK_INDEX.get(a.questionId) ?? 0) - (LOOP_BANK_INDEX.get(b.questionId) ?? 0)
  })[0]!
}

/** @deprecated Use pickNextLoopQuestion — kept for callers that have not migrated. */
export function pickLoopQuestionForJourney(journeyId: JourneyId | null | undefined): LoopQuestionBeat {
  const jid = journeyId && JOURNEY_IDS.includes(journeyId) ? journeyId : 'travel'
  return (
    pickNextLoopQuestion(jid) ??
    LOOP_QUESTION_BANK.find((b) => b.journeyKeys[0] === jid) ??
    LOOP_QUESTION_BANK[0]!
  )
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
  const plain = humanizeZoneHeadline(q, beat.journeyKeys[0])
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

function loopAnswerDisplay(beat: LoopQuestionBeat, raw: string): string {
  const t = raw.trim()
  const hit = beat.options.find((o) => o.value === t)
  if (hit) return hit.label
  return getOptionFullLabel(t)
}

export function getLoopBeatByQuestionId(questionId: string): LoopQuestionBeat | null {
  const qid = questionId.trim()
  if (!qid) return null
  return LOOP_QUESTION_BANK.find((b) => b.questionId === qid) ?? null
}

/** Display copy for takeover UI — jargon-safe even if an old beat string was cached. */
export function loopQuestionDisplayText(beat: LoopQuestionBeat): string {
  const lines = beat.question.split('\n').map((line) => {
    const t = line.trim()
    if (!t) return t
    return humanizeZoneHeadline(t, beat.journeyKeys[0]).toLowerCase()
  })
  return lines.join('\n')
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
