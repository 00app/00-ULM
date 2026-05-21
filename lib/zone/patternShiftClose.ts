import type { JourneyId } from '@/lib/journeys'

export type PatternShiftCloseMeta = {
  cardId?: string
  /** Pink visited card — close only, no loop takeover or injection APIs. */
  visitedClose?: boolean
}

export type PatternShiftCloseHandler = (journeyId: JourneyId, meta?: PatternShiftCloseMeta) => void
