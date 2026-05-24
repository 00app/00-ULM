import type { JourneyId } from '@/lib/journeys'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import {
  buildAchievementDiscoveryCard,
  injectNewDiscoveryCard,
  persistAchievementCardRemote,
} from '@/lib/discoveryInject'
import { headlineFromTitle, MAX_ZONE_CARD_HEADLINE_WORDS } from '@/lib/soloFocusCopy'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { LOOP_QUESTION_BANK, pickNextLoopQuestion } from '@/lib/zone/loopQuestions'
import { readStoredLoopAnswer } from '@/lib/zone/loopMemory'

/**
 * Loop bank exhausted — still birth a pink achievement from the journey’s canonical loop beat
 * (reuses stored answer; does not re-open the takeover question).
 */
export function spawnAchievementWhenLoopPoolExhausted(
  journeyId: JourneyId,
  onCard?: (card: ZoneTipCard) => void
): ZoneTipCard | null {
  if (typeof window === 'undefined') return null
  const beat = pickNextLoopQuestion(journeyId) ?? LOOP_QUESTION_BANK[0]!
  const answer =
    readStoredLoopAnswer(journeyId, beat.questionId)?.trim() ||
    beat.options[0]?.value?.trim() ||
    'YES'
  const rec = getDiscoveryRecommendation(journeyId, beat.questionId, answer)
  const title = headlineFromTitle(rec.headline || rec.body, MAX_ZONE_CARD_HEADLINE_WORDS)
  const url = rec.actionUrl ?? rec.learnUrl ?? rec.ctaUrl ?? null
  const card = injectNewDiscoveryCard(
    buildAchievementDiscoveryCard({
      journeyId,
      questionId: beat.questionId,
      answerValue: answer,
      title,
      body: rec.body,
      offerUrl: url,
    })
  )
  if (card) {
    onCard?.(card)
    persistAchievementCardRemote(card, {
      journeyId,
      questionId: beat.questionId,
      answerValue: answer,
    })
  }
  return card
}
