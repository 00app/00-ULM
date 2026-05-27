import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

/** Parent bento tile journey — category label + loop lane never follow morph drift. */
export function resolveFocusCategoryJourneyId(
  parentJourneyId: JourneyId | string | null | undefined,
  morphJourneyKey?: string | null
): JourneyId {
  const parent = String(parentJourneyId ?? '')
    .trim()
    .toLowerCase()
  if ((JOURNEY_ORDER as readonly string[]).includes(parent)) {
    return parent as JourneyId
  }
  const morph = String(morphJourneyKey ?? '')
    .trim()
    .toLowerCase()
  if ((JOURNEY_ORDER as readonly string[]).includes(morph)) {
    return morph as JourneyId
  }
  return 'home'
}

export function morphDeckAlignedWithJourney(
  deck: { journey_key?: string }[],
  journeyId: JourneyId
): boolean {
  return deck.every((m) => !m?.journey_key || m.journey_key === journeyId)
}

export function filterMorphDeckForJourney<T extends { journey_key?: string }>(
  deck: T[],
  journeyId: JourneyId
): T[] {
  return deck.filter((m) => !m.journey_key || m.journey_key === journeyId)
}
