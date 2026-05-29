import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'

export type SoloFocusJourneyNeighbors = {
  prev: JourneyId
  next: JourneyId
  prevLabel: string
  nextLabel: string
}

export function soloFocusJourneyNeighbors(current: JourneyId): SoloFocusJourneyNeighbors {
  const i = JOURNEY_ORDER.indexOf(current)
  const len = JOURNEY_ORDER.length
  const idx = i >= 0 ? i : 0
  const prev = JOURNEY_ORDER[(idx - 1 + len) % len]!
  const next = JOURNEY_ORDER[(idx + 1) % len]!
  return {
    prev,
    next,
    prevLabel: formatZoneCategoryLabel(prev),
    nextLabel: formatZoneCategoryLabel(next),
  }
}
