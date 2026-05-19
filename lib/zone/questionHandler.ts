/**
 * Infinite Agentic Loop — question queue for expanded journey cards.
 * Single place for "next question" logic and future Search-Refine-Inject wiring.
 *
 * Queue is always scoped to `journeyId` (maps to `journey_key` in Neon). DB-backed questions
 * (`journey_questions`) must use `WHERE journey_key = $1` only — see `lib/db/journeyQuestions.ts`.
 */

import { JOURNEYS, type JourneyId, type JourneyQuestion } from '@/lib/journeys'

/** Hard cap — 3 questions per journey category (Infrastructure / Behaviour / Readiness). */
export const QUESTIONS_PER_JOURNEY = 3

/** First unanswered question in the journey queue (options or number). */
export function getNextQuestion(
  journeyId: JourneyId,
  answers: Record<string, string>
): JourneyQuestion | null {
  const def = JOURNEYS[journeyId]
  const questions = (def?.questions ?? []).slice(0, QUESTIONS_PER_JOURNEY)
  const q = questions.find((question) => !answers[question.id] || String(answers[question.id]).trim() === '')
  return q ?? null
}

/** Whether this journey has at least one answer (used for progressive unlocking). */
export function hasAnyAnswer(journeyId: JourneyId, answers: Record<string, string>): boolean {
  const def = JOURNEYS[journeyId]
  const questions = def?.questions ?? []
  return questions.some((q) => answers[q.id] != null && String(answers[q.id]).trim() !== '')
}
