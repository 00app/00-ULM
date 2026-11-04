/**
 * Know your home agent — the questions that would teach us the most, across every category,
 * asked in one place. Each answer fills a household fact that the category rules read, so the
 * Zone's cards get sharper as it is used.
 *
 * Pure: give it a household. Questions come from the same gap ranking Solo Focus uses
 * (getGaps: heaviest missing fact first) and only ones with a card question to ask.
 */

import type { Household } from '@/lib/household/buildHousehold'
import { getGaps, knowledgeOf } from '@/lib/household/queries'
import type { HouseholdFactCategory } from '@/lib/household/records'
import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { getCardQuestion, type CardQuestion } from '@/lib/zone/cardQuestions'

/** Under this share of weighted facts known, the agent offers itself on Zone. */
export const KNOW_YOUR_HOME_THRESHOLD = 0.6
const MAX_QUESTIONS = 6

export type KnowledgeSummary = { known: number; total: number; score: number }

export function overallKnowledge(h: Household): KnowledgeSummary {
  let known = 0
  let total = 0
  let weightKnown = 0
  let weightTotal = 0
  for (const [category, specs] of Object.entries(CATEGORY_FACTS) as [HouseholdFactCategory, typeof CATEGORY_FACTS[HouseholdFactCategory]][]) {
    const k = knowledgeOf(h, category)
    known += k.known
    total += k.total
    for (const s of specs) {
      weightTotal += s.weight
      if (h.facts[s.key]) weightKnown += s.weight
    }
  }
  return { known, total, score: weightTotal === 0 ? 0 : weightKnown / weightTotal }
}

/**
 * The next questions to ask: one per category first (so it never feels like a form about one
 * thing), heaviest gap first, skipping questions that are resting after a skip.
 */
export function nextKnowledgeQuestions(
  h: Household,
  isResting: (questionId: string) => boolean,
  limit: number = MAX_QUESTIONS
): CardQuestion[] {
  const perCategory: CardQuestion[][] = []
  for (const category of Object.keys(CATEGORY_FACTS) as HouseholdFactCategory[]) {
    const qs = getGaps(h, category)
      .map((g) => (g.questionId ? getCardQuestion(g.questionId) : null))
      .filter((q): q is CardQuestion => q !== null && !isResting(q.questionId))
    if (qs.length) perCategory.push(qs)
  }
  // Round-robin across categories, heaviest category gap first in each pass.
  const out: CardQuestion[] = []
  for (let round = 0; out.length < limit; round++) {
    let added = false
    for (const qs of perCategory) {
      if (qs[round] && out.length < limit) {
        out.push(qs[round]!)
        added = true
      }
    }
    if (!added) break
  }
  return out
}

export function isKnowYourHomeEligible(h: Household, isResting: (questionId: string) => boolean): boolean {
  return overallKnowledge(h).score < KNOW_YOUR_HOME_THRESHOLD && nextKnowledgeQuestions(h, isResting, 1).length > 0
}
