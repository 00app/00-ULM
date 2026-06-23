import type { JourneyId } from '@/lib/journeys'

export type PatternShiftCloseMeta = {
  cardId?: string
  /** Pink visited card — close only, no loop takeover or injection APIs. */
  visitedClose?: boolean
  /** After like / nope — one-shot feedback beat (not the lifestyle loop bank). */
  offerFeedback?: 'like' | 'dislike'
  cardTitle?: string
}

export type PatternShiftCloseHandler = (journeyId: JourneyId, meta?: PatternShiftCloseMeta) => void
