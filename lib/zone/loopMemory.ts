import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'

const LOOP_ANSWERED_KEY = 'zz_loop_answered_ids'
const PINNED_ACHIEVEMENTS_KEY = 'zz_pinned_achievements'

/** Browser keys for loop learning + pins (dev reset / support). */
export const LEARNING_CACHE_KEYS = [
  LOOP_ANSWERED_KEY,
  PINNED_ACHIEVEMENTS_KEY,
  'zz_loop_answers_log',
  'zz_zai_likes',
  'zz_recent_chat_history',
] as const

export function clearLearningCacheLocal(): void {
  if (typeof window === 'undefined') return
  for (const key of LEARNING_CACHE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('journey_') && key.endsWith('_answers')) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
  }
}

export function readAnsweredLoopQuestionIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = safeGetItem(LOOP_ANSWERED_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))
  } catch {
    return new Set()
  }
}

export function markLoopQuestionAnswered(questionId: string): void {
  if (typeof window === 'undefined') return
  const id = questionId.trim()
  if (!id) return
  const next = readAnsweredLoopQuestionIds()
  next.add(id)
  try {
    safeSetItem(LOOP_ANSWERED_KEY, JSON.stringify([...next]))
  } catch {
    /* quota */
  }
}

export function readPinnedAchievementsFromStorage(): ZoneTipCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = safeGetItem(PINNED_ACHIEVEMENTS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (c): c is ZoneTipCard =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as ZoneTipCard).id === 'string' &&
        Boolean((c as ZoneTipCard).achievement_discovery)
    )
  } catch {
    return []
  }
}

export function persistPinnedAchievement(card: ZoneTipCard): void {
  if (typeof window === 'undefined' || !card.achievement_discovery) return
  const prev = readPinnedAchievementsFromStorage()
  const byId = new Map(prev.map((c) => [c.id, c]))
  byId.set(card.id, card)
  try {
    safeSetItem(PINNED_ACHIEVEMENTS_KEY, JSON.stringify([...byId.values()]))
  } catch {
    /* quota */
  }
}

/** Persist loop answers outside canonical journey MC ids (memory for learning loop). */
export function readStoredLoopAnswer(journeyId: JourneyId, questionId: string): string | null {
  if (typeof window === 'undefined') return null
  const qid = questionId.trim()
  if (!qid) return null
  try {
    const key = `journey_${journeyId}_answers`
    const raw = safeGetItem(key)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    const fromJourney = map[qid]?.trim()
    if (fromJourney) return fromJourney
    const logRaw = safeGetItem('zz_loop_answers_log')
    const log = logRaw ? (JSON.parse(logRaw) as Record<string, string>) : {}
    return log[`${journeyId}::${qid}`]?.trim() ?? null
  } catch {
    return null
  }
}

export function persistLoopAnswerLocal(params: {
  journeyId: JourneyId
  questionId: string
  answer: string
}): void {
  if (typeof window === 'undefined') return
  const journeyId = params.journeyId
  const questionId = params.questionId.trim()
  const answer = params.answer.trim()
  if (!questionId || !answer) return
  markLoopQuestionAnswered(questionId)
  try {
    const key = `journey_${journeyId}_answers`
    const prev = safeGetItem(key)
    const map = prev ? (JSON.parse(prev) as Record<string, string>) : {}
    map[questionId] = answer
    safeSetItem(key, JSON.stringify(map))
    const loopKey = 'zz_loop_answers_log'
    const logPrev = safeGetItem(loopKey)
    const log = logPrev ? (JSON.parse(logPrev) as Record<string, string>) : {}
    log[`${journeyId}::${questionId}`] = answer
    safeSetItem(loopKey, JSON.stringify(log))
  } catch {
    /* quota */
  }
}
