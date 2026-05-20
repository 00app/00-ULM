/**
 * Infinite Agentic Loop — question queue for expanded journey cards.
 * Single place for "next question" logic and future Search-Refine-Inject wiring.
 *
 * Queue is always scoped to `journeyId` (maps to `journey_key` in Neon). DB-backed questions
 * (`journey_questions`) must use `WHERE journey_key = $1` only — see `lib/db/journeyQuestions.ts`.
 */

import {
  QUESTIONS_PER_JOURNEY,
  SOLO_FOCUS_QUESTIONS_PER_JOURNEY,
  getJourneyQuestions,
  getSoloFocusQuestions,
  type JourneyId,
  type JourneyQuestion,
} from '@/lib/journeys'

export { QUESTIONS_PER_JOURNEY, SOLO_FOCUS_QUESTIONS_PER_JOURNEY }

/** First unanswered question in the journey queue (options or number). */
export function getNextQuestion(
  journeyId: JourneyId,
  answers: Record<string, string>
): JourneyQuestion | null {
  const questions = getJourneyQuestions(journeyId)
  const q = questions.find((question) => !answers[question.id] || String(answers[question.id]).trim() === '')
  return q ?? null
}

/** Solo Focus MVP — at most one embedded journey question before earned scrape. */
export function getSoloFocusNextQuestion(
  journeyId: JourneyId,
  answers: Record<string, string>
): JourneyQuestion | null {
  const questions = getSoloFocusQuestions(journeyId)
  const q = questions.find((question) => !answers[question.id] || String(answers[question.id]).trim() === '')
  return q ?? null
}

/** Whether this journey has at least one answer (used for progressive unlocking). */
export function hasAnyAnswer(journeyId: JourneyId, answers: Record<string, string>): boolean {
  const questions = getJourneyQuestions(journeyId)
  return questions.some((q) => answers[q.id] != null && String(answers[q.id]).trim() !== '')
}
