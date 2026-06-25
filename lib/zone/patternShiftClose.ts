import type { JourneyId } from '@/lib/journeys'

export type PatternShiftCloseMeta = {
  cardId?: string
  /** Active card journey — may differ from parent bento when morph deck is showing a sibling. */
  journeyId?: JourneyId
  /** Pink visited card — close only, no loop takeover or injection APIs. */
  visitedClose?: boolean
  /** After like / nope — one-shot feedback beat (not the lifestyle loop bank). */
  offerFeedback?: 'like' | 'dislike'
  cardTitle?: string
  cardHeadline?: string
  sourceUrl?: string
  offerUrl?: string
  verifiedProviderName?: string
}

export type PatternShiftCloseHandler = (journeyId: JourneyId, meta?: PatternShiftCloseMeta) => void
