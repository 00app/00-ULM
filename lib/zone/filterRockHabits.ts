import type { RockHabit } from '@/lib/rock/types'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { normalizeCardHeadlineKey } from '@/lib/soloFocusCopy'
import { normalizeOfferUrlKey } from '@/lib/zone/trustedJourneyUrls'

/** Drop Rock habits that repeat a journey mother tile or wall tip headline. */
export function filterRockHabitsAgainstWall(
  habits: RockHabit[],
  viewModel: ZoneViewModel
): RockHabit[] {
  const blocked = new Set<string>()
  for (const j of viewModel.journeys) {
    const key = normalizeCardHeadlineKey(j.title ?? '')
    if (key) blocked.add(key)
  }
  for (const t of viewModel.tips) {
    const key = normalizeCardHeadlineKey(t.title ?? '')
    if (key) blocked.add(key)
  }

  const seenRock = new Set<string>()
  const seenOfferByJourney = new Set<string>()
  const out: RockHabit[] = []
  for (const h of habits) {
    const key = normalizeCardHeadlineKey(h.title)
    if (!key || blocked.has(key) || seenRock.has(key)) continue
    const offerKey = normalizeOfferUrlKey((h.learn_url ?? '').trim())
    const laneKey = offerKey ? `${h.journey_key}:${offerKey}` : ''
    if (laneKey && seenOfferByJourney.has(laneKey)) continue
    seenRock.add(key)
    if (laneKey) seenOfferByJourney.add(laneKey)
    out.push(h)
  }
  return out
}
