/**
 * Hermes memory loop.
 * Stores compact recursive context in `users.user_genome.hermes_memory` so one journey
 * can inform the next without static fallbacks or client-only storage.
 */

import { getDbPool } from '@/lib/db'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { ImpactProfile, UserImpact } from '@/lib/brains/types'

export type HermesSavingsWin = {
  id: string
  journey: JourneyId
  money_gbp: number
  carbon_kg: number
  source: string
  answer_context?: string
  updated_at: string
}

export type HermesCarbonTrajectory = {
  journey: JourneyId
  annual_carbon_kg: number
  annual_saving_gbp: number
  direction: 'rising' | 'falling' | 'steady'
  updated_at: string
}

export type HermesCrossJourneySignal = {
  id: string
  sourceJourney: JourneyId
  affects: JourneyId[]
  instruction: string
}

export type HermesOfferFeedback = {
  card_id: string
  journey: JourneyId
  signal: 'like' | 'dislike' | 'indifferent' | 'ask'
  title?: string
  updated_at: string
}

export type HermesMemory = {
  v: 1
  updated_at: string
  savings_wins: HermesSavingsWin[]
  carbon_trajectories: HermesCarbonTrajectory[]
  cross_journey_signals: HermesCrossJourneySignal[]
  offer_feedback?: HermesOfferFeedback[]
  last_answer?: {
    journeyId: JourneyId
    questionId: string
    answerValue: string
  }
  skill_file: string
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96) || 'memory'
}

function compactAnswerContext(lastAnswer?: HermesMemory['last_answer']): string | undefined {
  if (!lastAnswer) return undefined
  return `${lastAnswer.journeyId}.${lastAnswer.questionId}=${lastAnswer.answerValue}`.slice(0, 180)
}

function hasTextMatch(answers: Record<string, string> | undefined, pattern: RegExp): boolean {
  if (!answers) return false
  return Object.entries(answers).some(([k, v]) => pattern.test(`${k} ${v}`))
}

function deriveCrossJourneySignals(
  journeyAnswers: Record<JourneyId, Record<string, string>>
): HermesCrossJourneySignal[] {
  const signals: HermesCrossJourneySignal[] = []
  if (hasTextMatch(journeyAnswers.home, /\b(solar|pv|battery|export|green_tariff)\b/i)) {
    signals.push({
      id: 'home-solar-generation',
      sourceJourney: 'home',
      affects: ['food', 'tech', 'money'],
      instruction:
        'Use the home solar or battery signal when ranking food, tech, and money tips: prefer daytime appliance loads, batch cooking, charging windows, and tariff/export checks.',
    })
  }
  if (hasTextMatch(journeyAnswers.travel, /\b(electric|hybrid|ev|train|bike|walk)\b/i)) {
    signals.push({
      id: 'travel-low-carbon-mobility',
      sourceJourney: 'travel',
      affects: ['home', 'money', 'holidays'],
      instruction:
        'Treat low-carbon mobility as reusable capacity: surface home charging, off-peak tariffs, travel substitution, and holiday rail/ferry angles before generic switching copy.',
    })
  }
  if (hasTextMatch(journeyAnswers.food, /\b(food_waste|waste|high|medium|batch|freezer)\b/i)) {
    signals.push({
      id: 'food-waste-control',
      sourceJourney: 'food',
      affects: ['waste', 'shopping', 'money'],
      instruction:
        'Carry food waste answers into waste, shopping, and money: prioritise meal planning, freezer use, bulk buys only where waste risk is low, and compost only after prevention.',
    })
  }
  if (hasTextMatch(journeyAnswers.money, /\b(finances_tight|yes|housing|energy|food|travel)\b/i)) {
    signals.push({
      id: 'money-pressure-mode',
      sourceJourney: 'money',
      affects: ['home', 'food', 'travel', 'shopping'],
      instruction:
        'When money pressure is present, rank low-friction cash wins first and avoid high-upfront-cost recommendations unless a grant or rebate is evidenced.',
    })
  }
  return signals
}

function mergeWins(existing: HermesSavingsWin[], next: HermesSavingsWin[]): HermesSavingsWin[] {
  const byId = new Map<string, HermesSavingsWin>()
  for (const win of [...existing, ...next]) byId.set(win.id, win)
  return Array.from(byId.values())
    .sort((a, b) => b.money_gbp + b.carbon_kg * 0.15 - (a.money_gbp + a.carbon_kg * 0.15))
    .slice(0, 18)
}

function buildHermesSkillFile(memory: Omit<HermesMemory, 'skill_file'>): string {
  const wins = memory.savings_wins.length
    ? memory.savings_wins
        .map((w) => `- ${w.journey}: £${w.money_gbp}/yr, ${w.carbon_kg}kg CO2e/yr (${w.source})`)
        .join('\n')
    : '- No confirmed savings wins yet.'
  const trajectories = memory.carbon_trajectories.length
    ? memory.carbon_trajectories
        .map(
          (t) =>
            `- ${t.journey}: ${t.annual_carbon_kg}kg CO2e/yr, £${t.annual_saving_gbp}/yr, ${t.direction}`
        )
        .join('\n')
    : '- No carbon trajectories yet.'
  const signals = memory.cross_journey_signals.length
    ? memory.cross_journey_signals
        .map((s) => `- ${s.id}: ${s.sourceJourney} -> ${s.affects.join(', ')}. ${s.instruction}`)
        .join('\n')
    : '- No cross-journey signals yet.'
  const feedback = (memory.offer_feedback ?? []).length
    ? memory.offer_feedback!
        .map(
          (f) =>
            `- ${f.signal}: ${f.journey} · ${f.title?.trim() || f.card_id} (${f.updated_at.slice(0, 10)})`
        )
        .join('\n')
    : '- No offer feedback yet.'

  return [
    '# Hermes Recursive Skill',
    '',
    'Use this memory before generating the next Zero Zero card, tip, or research prompt. Treat it as user-specific context, not generic copy.',
    '',
    '## Savings Wins',
    wins,
    '',
    '## Carbon Trajectories',
    trajectories,
    '',
    '## Cross-Journey Signals',
    signals,
    '',
    '## Offer Feedback',
    feedback,
    '',
    '## Rules',
    '- Deprioritise card topics the user disliked or closed without engaging; prefer liked or asked topics when ranking.',
    '- Pull lessons forward across journeys: home energy can affect food, tech, and money; travel can affect home charging and holidays.',
    '- Prefer remembered low-friction wins before high-upfront-cost recommendations.',
    '- If live research contradicts this memory, trust the live research and update Hermes after the answer is stored.',
  ].join('\n')
}

function parseExistingMemory(raw: unknown): HermesMemory | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Partial<HermesMemory>
  return {
    v: 1,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    savings_wins: Array.isArray(row.savings_wins) ? (row.savings_wins as HermesSavingsWin[]) : [],
    carbon_trajectories: Array.isArray(row.carbon_trajectories)
      ? (row.carbon_trajectories as HermesCarbonTrajectory[])
      : [],
    cross_journey_signals: Array.isArray(row.cross_journey_signals)
      ? (row.cross_journey_signals as HermesCrossJourneySignal[])
      : [],
    offer_feedback: Array.isArray(row.offer_feedback)
      ? (row.offer_feedback as HermesOfferFeedback[])
      : [],
    last_answer: row.last_answer,
    skill_file: typeof row.skill_file === 'string' ? row.skill_file : '',
  }
}

function normalizeJourneyKey(raw?: string | null): JourneyId | null {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^journey-/, '')
  return (JOURNEY_ORDER as readonly string[]).includes(k) ? (k as JourneyId) : null
}

function mergeOfferFeedback(
  existing: HermesOfferFeedback[],
  next: HermesOfferFeedback
): HermesOfferFeedback[] {
  const byCard = new Map<string, HermesOfferFeedback>()
  for (const row of existing) byCard.set(row.card_id, row)
  byCard.set(next.card_id, next)
  return Array.from(byCard.values())
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 24)
}

export async function updateHermesMemoryAfterOfferSignal(params: {
  userId: string
  cardId: string
  journeyKey?: string | null
  signal: HermesOfferFeedback['signal']
  cardTitle?: string | null
}): Promise<HermesMemory | null> {
  const uid = params.userId?.trim()
  const cardId = params.cardId?.trim()
  if (!uid || !cardId) return null

  const journey = normalizeJourneyKey(params.journeyKey) ?? 'home'
  const now = new Date().toISOString()
  const pool = getDbPool()
  let existing: HermesMemory | null = null
  try {
    const row = await pool.query<{ hermes_memory: unknown }>(
      `SELECT user_genome->'hermes_memory' AS hermes_memory FROM users WHERE id = $1 LIMIT 1`,
      [uid]
    )
    existing = parseExistingMemory(row.rows[0]?.hermes_memory)
  } catch {
    existing = null
  }

  const nextFeedback: HermesOfferFeedback = {
    card_id: cardId.slice(0, 120),
    journey,
    signal: params.signal,
    title: params.cardTitle?.trim() ? params.cardTitle.trim().slice(0, 160) : undefined,
    updated_at: now,
  }

  const memoryCore: Omit<HermesMemory, 'skill_file'> = {
    v: 1,
    updated_at: now,
    savings_wins: existing?.savings_wins ?? [],
    carbon_trajectories: existing?.carbon_trajectories ?? [],
    cross_journey_signals: existing?.cross_journey_signals ?? [],
    offer_feedback: mergeOfferFeedback(existing?.offer_feedback ?? [], nextFeedback),
    last_answer: existing?.last_answer,
  }
  const memory: HermesMemory = {
    ...memoryCore,
    skill_file: buildHermesSkillFile(memoryCore).slice(0, 12000),
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`)
    await pool.query(
      `UPDATE users
       SET user_genome = jsonb_set(COALESCE(user_genome, '{}'::jsonb), '{hermes_memory}', $2::jsonb, true)
       WHERE id = $1`,
      [uid, JSON.stringify(memory)]
    )
    return memory
  } catch {
    return null
  }
}

export async function updateHermesMemoryAfterAnswer(params: {
  userId: string
  profile?: ImpactProfile
  journeyAnswers: Record<JourneyId, Record<string, string>>
  userImpact: UserImpact
  lastAnswer: {
    journeyId: JourneyId
    questionId: string
    answerValue: string
  }
}): Promise<HermesMemory | null> {
  const uid = params.userId?.trim()
  if (!uid) return null

  const pool = getDbPool()
  const now = new Date().toISOString()
  let existing: HermesMemory | null = null
  try {
    const row = await pool.query<{ hermes_memory: unknown }>(
      `SELECT user_genome->'hermes_memory' AS hermes_memory
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [uid]
    )
    existing = parseExistingMemory(row.rows[0]?.hermes_memory)
  } catch {
    existing = null
  }

  const answerContext = compactAnswerContext(params.lastAnswer)
  const nextWins = JOURNEY_ORDER.flatMap((journey) => {
    const impact = params.userImpact.perJourneyResults[journey]
    if (!impact) return []
    const money = Math.max(0, Math.round(impact.moneyGbp))
    const carbon = Math.max(0, Math.round(impact.carbonKg))
    if (money <= 0 && carbon <= 0) return []
    return [
      {
        id: slug(`${journey}-${impact.source}-${money}-${carbon}`),
        journey,
        money_gbp: money,
        carbon_kg: carbon,
        source: String(impact.source || 'impact model').slice(0, 160),
        answer_context: journey === params.lastAnswer.journeyId ? answerContext : undefined,
        updated_at: now,
      },
    ]
  })

  const carbon_trajectories = JOURNEY_ORDER.map((journey) => {
    const impact = params.userImpact.perJourneyResults[journey]
    const previous = existing?.carbon_trajectories.find((t) => t.journey === journey)
    const carbon = Math.max(0, Math.round(impact?.carbonKg ?? 0))
    const prevCarbon = previous?.annual_carbon_kg ?? carbon
    return {
      journey,
      annual_carbon_kg: carbon,
      annual_saving_gbp: Math.max(0, Math.round(impact?.moneyGbp ?? 0)),
      direction: carbon < prevCarbon ? 'falling' : carbon > prevCarbon ? 'rising' : 'steady',
      updated_at: now,
    } satisfies HermesCarbonTrajectory
  })

  const memoryCore: Omit<HermesMemory, 'skill_file'> = {
    v: 1,
    updated_at: now,
    savings_wins: mergeWins(existing?.savings_wins ?? [], nextWins),
    carbon_trajectories,
    cross_journey_signals: deriveCrossJourneySignals(params.journeyAnswers),
    last_answer: params.lastAnswer,
  }
  const memory: HermesMemory = {
    ...memoryCore,
    skill_file: buildHermesSkillFile(memoryCore).slice(0, 12000),
  }

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`)
    await pool.query(
      `UPDATE users
       SET user_genome = jsonb_set(
         COALESCE(user_genome, '{}'::jsonb),
         '{hermes_memory}',
         $2::jsonb,
         true
       )
       WHERE id = $1`,
      [uid, JSON.stringify(memory)]
    )
    return memory
  } catch {
    return null
  }
}
