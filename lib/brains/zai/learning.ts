import { getDbPool } from '@/lib/db'
import {
  getJourneyAnswersJsonbOnly,
  persistDiscoveryInjection,
  upsertJourneyAnswerJsonb,
  upsertUserGenomeFromAnswer,
} from '@/lib/db/neon'
import { updateHermesMemoryAfterAnswer } from '@/lib/agents/hermes-memory'
import { buildUserImpact } from '@/lib/brains/buildUserImpact'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { normalizeEmploymentStatus } from '@/lib/brains/calculations'
import type { ImpactProfile } from '@/lib/brains/types'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { isValidLoopOrJourneyQuestion } from '@/lib/zone/loopQuestions'
import { summarizeImpactForUser } from '@/lib/brains/zai/genomeContext'

export type ZaiBehaviorShift = {
  journeyId: JourneyId
  questionId: string
  answerValue: string
}

type ShiftRule = {
  test: RegExp
  journeyId: JourneyId
  questionId: string
  value: string
}

/** Map natural-language chat to valid loop / journey answer keys. */
const CHAT_SHIFT_RULES: ShiftRule[] = [
  { test: /\b(heat\s*pump|ashp|air[\s-]?source)\b/i, journeyId: 'home', questionId: 'home_heat_pump', value: 'YES' },
  { test: /\b(stay\s+on\s+gas|gas\s+boiler|keep\s+gas)\b/i, journeyId: 'home', questionId: 'home_heat_pump', value: 'STAY ON GAS' },
  { test: /\b(loft\s+insul|cavity\s+wall)\b/i, journeyId: 'home', questionId: 'home_loft_insulate', value: 'YES' },
  { test: /\b(solar|pv\s+panel|panels\s+on\s+(?:the\s+)?roof)\b/i, journeyId: 'solar', questionId: 'solar_roof_fit', value: 'YES' },
  { test: /\b(ev\b|electric\s+(?:car|vehicle)|plug[\s-]?in)\b/i, journeyId: 'travel', questionId: 'travel_ev_commute', value: 'YES — EV' },
  { test: /\b(rail|train)\s+instead\s+of\s+(?:fly|flight)/i, journeyId: 'travel', questionId: 'travel_rail_vs_flight', value: 'YES — RAIL' },
  { test: /\b(plant[\s-]?based|vegan|vegetarian)\b/i, journeyId: 'food', questionId: 'food_plant_shift', value: 'YES' },
  { test: /\b(compost|food\s+scraps)\b/i, journeyId: 'waste', questionId: 'waste_compost', value: 'YES' },
  { test: /\b(smart\s+tariff|off[\s-]?peak|time[\s-]?of[\s-]?use)\b/i, journeyId: 'money', questionId: 'money_smart_tariff', value: 'YES' },
]

/**
 * Detect a behavioural shift the user stated in chat (user message weighted).
 */
export function detectBehaviorShiftFromChat(
  userMessage: string,
  assistantMessage: string,
  existing: Record<string, Record<string, string>>
): ZaiBehaviorShift | null {
  const blob = `${userMessage}\n${assistantMessage}`.trim()
  if (blob.length < 8) return null

  for (const rule of CHAT_SHIFT_RULES) {
    if (!rule.test.test(blob)) continue
    if (!isValidLoopOrJourneyQuestion(rule.journeyId, rule.questionId)) continue
    const current = existing[rule.journeyId]?.[rule.questionId]
    if (current && String(current).trim().toUpperCase() === rule.value.toUpperCase()) continue
    return {
      journeyId: rule.journeyId,
      questionId: rule.questionId,
      answerValue: rule.value,
    }
  }
  return null
}

function toImpactProfile(row: Record<string, unknown> | undefined): ImpactProfile | undefined {
  if (!row) return undefined
  const ageVal = row.age_group ?? row.age
  return {
    name: typeof row.name === 'string' ? row.name : undefined,
    postcode: typeof row.postcode === 'string' ? row.postcode : undefined,
    household: typeof row.household === 'string' ? row.household : undefined,
    home_type: typeof row.home_type === 'string' ? row.home_type : undefined,
    transport_baseline: typeof row.transport_baseline === 'string' ? row.transport_baseline : undefined,
    age: (['JUNIOR', 'MID', 'RETIRED'] as const).includes(ageVal as 'JUNIOR' | 'MID' | 'RETIRED')
      ? (ageVal as 'JUNIOR' | 'MID' | 'RETIRED')
      : undefined,
    employment_status: normalizeEmploymentStatus(
      typeof row.employment_status === 'string' ? row.employment_status : undefined
    ),
  }
}

/** Recompute £/kg from Neon answers and refresh Hermes memory when a shift was stored. */
export async function triggerImpactRecomputation(
  userId: string,
  lastShift?: ZaiBehaviorShift | null
): Promise<{ totalMoney: number; totalCarbon: number }> {
  const journeyAnswers = (await getJourneyAnswersJsonbOnly(userId)) as Record<
    JourneyId,
    Record<string, string>
  >
  const pool = getDbPool()
  const userRow = await pool
    .query<Record<string, unknown>>(
      `SELECT name, postcode, household, home_type, transport_baseline, age_group, employment_status
       FROM users WHERE id = $1`,
      [userId]
    )
    .then((r) => r.rows[0])
    .catch(() => undefined)

  const profile = toImpactProfile(userRow)
  const filled = Object.fromEntries(
    JOURNEY_ORDER.map((jid) => [jid, journeyAnswers[jid] ?? {}])
  ) as Record<JourneyId, Record<string, string>>
  const homeUnitRates = await resolveLiveUnitRatesForPostcode(profile?.postcode ?? null)
  const impact = buildUserImpact(
    { profile, journeyAnswers: filled },
    homeUnitRates ? { homeUnitRates } : undefined
  )

  if (lastShift) {
    await updateHermesMemoryAfterAnswer({
      userId,
      profile,
      journeyAnswers: filled,
      userImpact: impact,
      lastAnswer: {
        journeyId: lastShift.journeyId,
        questionId: lastShift.questionId,
        answerValue: lastShift.answerValue,
      },
    }).catch(() => {})
  }

  return {
    totalMoney: impact.totals.totalMoney,
    totalCarbon: impact.totals.totalCarbon,
  }
}

async function appendZaiChatLearningGenome(
  userId: string,
  entry: { journeyId: string; questionId: string; value: string; question: string }
): Promise<void> {
  const pool = getDbPool()
  const payload = {
    at: new Date().toISOString(),
    journeyId: entry.journeyId,
    questionId: entry.questionId,
    value: entry.value.slice(0, 200),
    question: entry.question.slice(0, 300),
  }
  try {
    await pool.query(
      `UPDATE users
       SET user_genome = jsonb_set(
         COALESCE(user_genome, '{}'::jsonb),
         '{zai_chat_learnings}',
         (
           COALESCE(user_genome->'zai_chat_learnings', '[]'::jsonb) || jsonb_build_array($2::jsonb)
         )::jsonb,
         true
       )
       WHERE id = $1::uuid`,
      [userId, JSON.stringify(payload)]
    )
  } catch {
    /* non-blocking */
  }
}

export type FinalizeZaiChatLearningResult = {
  shift: ZaiBehaviorShift | null
  totals: { totalMoney: number; totalCarbon: number }
}

/**
 * Brain stomach — persist chat shifts to journey_answers_jsonb and recompute hero totals.
 */
export async function finalizeZaiChatLearning(args: {
  userId: string
  userMessage: string
  assistantMessage: string
  journeyAnswers: Record<string, Record<string, string>>
  profile?: ImpactProfile
}): Promise<FinalizeZaiChatLearningResult> {
  const shift = detectBehaviorShiftFromChat(
    args.userMessage,
    args.assistantMessage,
    args.journeyAnswers
  )

  if (shift) {
    await upsertJourneyAnswerJsonb(
      args.userId,
      shift.journeyId,
      shift.questionId,
      shift.answerValue
    )
    await upsertUserGenomeFromAnswer(
      args.userId,
      shift.journeyId,
      shift.questionId,
      shift.answerValue
    )
    await appendZaiChatLearningGenome(args.userId, {
      journeyId: shift.journeyId,
      questionId: shift.questionId,
      value: shift.answerValue,
      question: args.userMessage,
    })
  }

  const totals = shift
    ? await triggerImpactRecomputation(args.userId, shift)
    : await summarizeImpactForUser({
        profile: args.profile,
        journeyAnswers: args.journeyAnswers as Record<JourneyId, Record<string, string>>,
      })

  return { shift, totals }
}

/** Pin a high-intent URL from chat into discovery_injections (suggestions rail). */
export async function pinZaiSuggestionLink(args: {
  userId: string
  url: string
  title?: string
  journeyKey?: string
}): Promise<void> {
  const url = args.url.trim()
  if (!url.startsWith('http')) return
  let hostname = 'link'
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return
  }
  const cardId = `suggest_${Buffer.from(url).toString('base64url').slice(0, 48)}`
  await persistDiscoveryInjection(
    args.userId,
    cardId,
    {
      url,
      status: 'pinned',
      title: args.title ?? `Act on ${hostname}`,
      source: 'zai_chat',
    },
    'zai_suggestion_pinned',
    { journey_key: args.journeyKey?.slice(0, 64) ?? null }
  )
}
