/**
 * Knowledge gathering — which questions exist and which household fact each one fills.
 *
 * Shared by the client (Solo Focus, agents) and /api/knowledge so both agree on what a valid
 * question is. A question is known when it is a Solo Focus card question (lib/zone/cardQuestions)
 * or a loop question (lib/zone/loopQuestions). The fact key comes from the card question itself,
 * else from the fact registry entry that names the question.
 */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { JOURNEY_IDS, type JourneyId } from '@/lib/journeys'
import { getCardQuestion } from '@/lib/zone/cardQuestions'
import { LOOP_QUESTION_BANK } from '@/lib/zone/loopQuestions'

export type KnowledgeSource = 'solo_focus' | 'loop' | 'agent' | 'zai'
export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = ['solo_focus', 'loop', 'agent', 'zai']

/** Skipped and "not sure" questions rest this long before they are asked again. */
export const KNOWLEDGE_SNOOZE_DAYS = 30

const LOOP_IDS = new Set(LOOP_QUESTION_BANK.map((b) => b.questionId))

const FACT_BY_QUESTION: ReadonlyMap<string, { key: string; category: string }> = (() => {
  const m = new Map<string, { key: string; category: string }>()
  for (const [category, specs] of Object.entries(CATEGORY_FACTS)) {
    for (const spec of specs) {
      if (spec.questionId && !m.has(spec.questionId)) m.set(spec.questionId, { key: spec.key, category })
    }
  }
  return m
})()

export function isKnownQuestion(questionId: string): boolean {
  const id = String(questionId ?? '').trim()
  return Boolean(id) && (getCardQuestion(id) !== null || LOOP_IDS.has(id))
}

/** The household_facts field a question fills, or null when it only feeds loop memory. */
export function factKeyForQuestion(questionId: string): string | null {
  return getCardQuestion(questionId)?.fieldKey ?? FACT_BY_QUESTION.get(questionId)?.key ?? null
}

/** household_facts.category for a question: the fact registry's category, else the journey. */
export function factCategoryForQuestion(questionId: string, journeyId: string): string {
  return FACT_BY_QUESTION.get(questionId)?.category ?? journeyId
}

export function isJourneyId(v: unknown): v is JourneyId {
  return typeof v === 'string' && (JOURNEY_IDS as readonly string[]).includes(v)
}
