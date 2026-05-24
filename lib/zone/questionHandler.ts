/**
 * Journey question queue — profile onboarding vs Zone Solo Focus vs post-close loop.
 *
 * | Surface | Question source | Count |
 * |---------|-----------------|-------|
 * | `/profile` | Profile steps incl. `home_power` | onboarding only |
 * | Zone expand (Solo Focus) | `getSoloFocusNextQuestion` — first unanswered in **solo** slot | **1** per open |
 * | After zip-shut close | `pickNextLoopQuestion` (`loopQuestions.ts`) | 1 lifestyle beat |
 *
 * Profile `home_power` seeds utilities/home answers — never re-asked in Solo Focus.
 */

import {
  QUESTIONS_PER_JOURNEY,
  SOLO_FOCUS_QUESTIONS_PER_JOURNEY,
  getJourneyQuestions,
  getSoloFocusQuestions,
  type JourneyId,
  type JourneyQuestion,
} from '@/lib/journeys'
import {
  profileHomePowerToEnergyType,
  readProfileHomePowerFromStorage,
} from '@/lib/profile/homePower'

export { QUESTIONS_PER_JOURNEY, SOLO_FOCUS_QUESTIONS_PER_JOURNEY }

/** Merge local journey answers with optional AppContext / Neon hydrate. */
export function mergeJourneyAnswerMaps(
  journeyId: JourneyId,
  local: Record<string, string>,
  fromContext?: Record<string, string> | null
): Record<string, string> {
  return { ...local, ...(fromContext ?? {}) }
}

/** Profile leading question → journey tiles (client storage). */
export function mergeProfileSeededAnswers(
  journeyId: JourneyId,
  answers: Record<string, string>
): Record<string, string> {
  const merged = { ...answers }
  const homePower = readProfileHomePowerFromStorage()
  if (!homePower.trim()) return merged
  const normalized = homePower.trim().toUpperCase()
  if (journeyId === 'utilities' && !String(merged.home_power ?? '').trim()) {
    merged.home_power = normalized
  }
  if (journeyId === 'home') {
    const energy = profileHomePowerToEnergyType(homePower)
    if (energy && !String(merged.energy_type ?? '').trim()) {
      merged.energy_type = energy
    }
  }
  return merged
}

function effectiveAnswers(
  journeyId: JourneyId,
  answers: Record<string, string>
): Record<string, string> {
  return mergeProfileSeededAnswers(journeyId, answers)
}

/** First unanswered question in the full journey queue (settings / edit flows). */
export function getNextQuestion(
  journeyId: JourneyId,
  answers: Record<string, string>
): JourneyQuestion | null {
  const merged = effectiveAnswers(journeyId, answers)
  const questions = getJourneyQuestions(journeyId)
  const q = questions.find(
    (question) => !merged[question.id] || String(merged[question.id]).trim() === ''
  )
  return q ?? null
}

/** Solo Focus — one high-leverage registry question per card open (first unanswered solo slot). */
export function getSoloFocusNextQuestion(
  journeyId: JourneyId,
  answers: Record<string, string>
): JourneyQuestion | null {
  const merged = effectiveAnswers(journeyId, answers)
  const questions = getSoloFocusQuestions(journeyId)
  const q = questions.find(
    (question) => !merged[question.id] || String(merged[question.id]).trim() === ''
  )
  return q ?? null
}

/** Whether this journey has at least one answer (used for progressive unlocking). */
export function hasAnyAnswer(journeyId: JourneyId, answers: Record<string, string>): boolean {
  const merged = effectiveAnswers(journeyId, answers)
  const questions = getJourneyQuestions(journeyId)
  return questions.some((q) => merged[q.id] != null && String(merged[q.id]).trim() !== '')
}
