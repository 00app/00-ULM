import type { JourneyId } from '@/lib/journeys'
import { ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import type { RockHabit } from '@/lib/rock/types'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { normalizeCardHeadlineKey } from '@/lib/soloFocusCopy'
import { capRockHabitsPerJourney, dedupeFirstWinByJourney } from '@/lib/zone/perCategoryCardCap'
import { normalizeOfferUrlKey } from '@/lib/zone/trustedJourneyUrls'

/** Journey mother tiles already on the bento wall — Today's Tips must use other lanes. */
export function getWallMotherJourneyKeys(viewModel: ZoneViewModel): Set<JourneyId> {
  const keys = new Set<JourneyId>()
  for (const j of viewModel.journeys) {
    if (j.id.startsWith('journey-') && j.journey_key) keys.add(j.journey_key)
  }
  return keys
}

type FilterRockOpts = {
  /** When true (default), drop habits whose journey_key matches a journey- mother tile. */
  excludeWallJourneyKeys?: boolean
}

/** Drop Rock habits that repeat a journey mother tile or wall tip headline. */
export function filterRockHabitsAgainstWall(
  habits: RockHabit[],
  viewModel: ZoneViewModel,
  opts: FilterRockOpts = {}
): RockHabit[] {
  const excludeWallJourneyKeys = opts.excludeWallJourneyKeys !== false
  const wallJourneys = getWallMotherJourneyKeys(viewModel)
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
    if (excludeWallJourneyKeys && wallJourneys.has(h.journey_key)) continue
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

/**
 * Today's Tips rail — complementary to journey mother tiles: no shared journey_key with the wall,
 * one habit per journey, fill up to `limit` from catalog off-wall habits only.
 */
export function prepareRockHabitsForRail(
  rotationHabits: RockHabit[],
  viewModel: ZoneViewModel,
  limit: number
): RockHabit[] {
  const wallJourneys = getWallMotherJourneyKeys(viewModel)
  const offWallRotation = rotationHabits.filter((h) => !wallJourneys.has(h.journey_key))
  const out = filterRockHabitsAgainstWall(
    dedupeFirstWinByJourney(capRockHabitsPerJourney(offWallRotation, 1)),
    viewModel,
    { excludeWallJourneyKeys: true }
  )

  const seenSlug = new Set(out.map((h) => h.slug))
  const seenJourney = new Set(out.map((h) => h.journey_key))
  for (const h of ROCK_HABITS) {
    if (out.length >= limit) break
    if (wallJourneys.has(h.journey_key)) continue
    if (seenSlug.has(h.slug) || seenJourney.has(h.journey_key)) continue
    seenSlug.add(h.slug)
    seenJourney.add(h.journey_key)
    out.push(h)
  }

  // Full bento has all 13 journey mothers — off-wall catalog is empty; fill rail from rotation (headline dedupe only).
  if (out.length < limit) {
    const pool = dedupeFirstWinByJourney(
      capRockHabitsPerJourney(
        [...rotationHabits, ...ROCK_HABITS.filter((h) => !seenSlug.has(h.slug))],
        1
      )
    )
    const fallback = filterRockHabitsAgainstWall(pool, viewModel, {
      excludeWallJourneyKeys: false,
    })
    for (const h of fallback) {
      if (out.length >= limit) break
      if (seenSlug.has(h.slug) || seenJourney.has(h.journey_key)) continue
      seenSlug.add(h.slug)
      seenJourney.add(h.journey_key)
      out.push(h)
    }
  }

  return dedupeFirstWinByJourney(out).slice(0, limit)
}
