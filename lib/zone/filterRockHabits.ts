import type { JourneyId } from '@/lib/journeys'
import { ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import type { RockHabit } from '@/lib/rock/types'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { normalizeCardHeadlineKey } from '@/lib/soloFocusCopy'
import { capRockHabitsPerJourney, dedupeFirstWinByJourney } from '@/lib/zone/perCategoryCardCap'
import { getUkSeason } from '@/lib/zone/seasonHint'
import { prioritizeSeasonTipsForVisibleRail, sortRockHabitsBySeasonStable } from '@/lib/zone/seasonRail'
import { normalizeOfferUrlKey } from '@/lib/zone/trustedJourneyUrls'

/** Journey mother tiles already on the bento wall — Today's Tips must use other lanes. */
export function getWallMotherJourneyKeys(viewModel: ZoneViewModel): Set<JourneyId> {
  const keys = new Set<JourneyId>()
  for (const j of viewModel.journeys) {
    if (j.id.startsWith('journey-') && j.journey_key) keys.add(j.journey_key)
  }
  return keys
}

function getBlockedWallHeadlineKeys(viewModel: ZoneViewModel): Set<string> {
  const blocked = new Set<string>()
  for (const j of viewModel.journeys) {
    const key = normalizeCardHeadlineKey(j.title ?? '')
    if (key) blocked.add(key)
  }
  for (const t of viewModel.tips) {
    const key = normalizeCardHeadlineKey(t.title ?? '')
    if (key) blocked.add(key)
  }
  return blocked
}

type FilterRockOpts = {
  /** When true (default), drop habits whose journey_key matches a journey- mother tile. */
  excludeWallJourneyKeys?: boolean
}

export type HabitProfileFilter = {
  home_type?: string | null
  transport?: string | null
  power_type?: string | null
  tenure?: string | null
}

/** Filter a habit list by profile — soft gate: missing profile fields never exclude. */
export function filterHabitsByProfile(
  habits: RockHabit[],
  profile?: HabitProfileFilter | null
): RockHabit[] {
  if (!profile) return habits
  return habits.filter((h) => habitMatchesProfile(h, profile))
}

/** Return false only when we are confident the habit is irrelevant for this profile. */
function habitMatchesProfile(h: RockHabit, profile: HabitProfileFilter): boolean {
  const { applicable } = h
  if (!applicable) return true
  if (applicable.home_type && profile.home_type) {
    if (!applicable.home_type.includes(profile.home_type)) return false
  }
  if (applicable.transport && profile.transport) {
    if (!applicable.transport.includes(profile.transport)) return false
  }
  if (applicable.power_type && profile.power_type) {
    if (!applicable.power_type.includes(profile.power_type)) return false
  }
  if (applicable.tenure && profile.tenure) {
    if (!applicable.tenure.includes(profile.tenure)) return false
  }
  return true
}

/** Drop Rock habits that repeat a journey mother tile or wall tip headline. */
export function filterRockHabitsAgainstWall(
  habits: RockHabit[],
  viewModel: ZoneViewModel,
  opts: FilterRockOpts = {}
): RockHabit[] {
  const excludeWallJourneyKeys = opts.excludeWallJourneyKeys !== false
  const wallJourneys = getWallMotherJourneyKeys(viewModel)
  const blocked = getBlockedWallHeadlineKeys(viewModel)

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

function sortByGoalBias(habits: RockHabit[], goal?: string | null): RockHabit[] {
  const g = String(goal ?? '').toLowerCase().trim()
  if (g === 'money' || g === 'save' || g === 'save_money') {
    return [...habits].sort((a, b) => b.money_gbp - a.money_gbp)
  }
  if (g === 'carbon' || g === 'reduce' || g === 'reduce_carbon') {
    return [...habits].sort((a, b) => b.carbon_kg - a.carbon_kg)
  }
  return habits
}

/**
 * Today's Tips rail — prefer off-wall journeys; then catalog habits whose titles differ from wall hooks.
 * One habit per journey_key; up to `limit` slots (RockSavingTips shows six).
 */
export function prepareRockHabitsForRail(
  rotationHabits: RockHabit[],
  viewModel: ZoneViewModel,
  limit: number,
  goal?: string | null,
  profile?: HabitProfileFilter | null
): RockHabit[] {
  const season = getUkSeason()
  const wallFilteredRotation = filterRockHabitsAgainstWall(filterHabitsByProfile(rotationHabits, profile), viewModel)
  const wallFilteredCatalog = filterRockHabitsAgainstWall(filterHabitsByProfile(ROCK_HABITS, profile), viewModel)
  const seasonSortedRotation = sortRockHabitsBySeasonStable(wallFilteredRotation, season)
  const seasonSortedCatalog = sortRockHabitsBySeasonStable(wallFilteredCatalog, season)
  const wallJourneys = getWallMotherJourneyKeys(viewModel)
  const blockedHeadlines = getBlockedWallHeadlineKeys(viewModel)
  const out: RockHabit[] = []
  const seenSlug = new Set<string>()
  const seenJourney = new Set<string>()

  const tryAdd = (h: RockHabit, requireOffWall: boolean) => {
    if (out.length >= limit) return
    if (seenSlug.has(h.slug) || seenJourney.has(h.journey_key)) return
    if (requireOffWall && wallJourneys.has(h.journey_key)) return
    const headlineKey = normalizeCardHeadlineKey(h.title)
    if (!headlineKey || blockedHeadlines.has(headlineKey)) return
    seenSlug.add(h.slug)
    seenJourney.add(h.journey_key)
    out.push(h)
  }

  const offWallRotation = seasonSortedRotation.filter((h) => !wallJourneys.has(h.journey_key))
  for (const h of dedupeFirstWinByJourney(capRockHabitsPerJourney(offWallRotation, 1))) {
    tryAdd(h, true)
  }

  for (const h of seasonSortedCatalog) {
    if (out.length >= limit) break
    tryAdd(h, true)
  }

  if (out.length < limit) {
    const pool = dedupeFirstWinByJourney(
      capRockHabitsPerJourney(
        [
          ...seasonSortedRotation,
          ...seasonSortedCatalog.filter((h) => !seenSlug.has(h.slug)),
        ],
        1
      )
    )
    for (const h of pool) {
      if (out.length >= limit) break
      tryAdd(h, false)
    }
  }

  const result = prioritizeSeasonTipsForVisibleRail(out.slice(0, limit), season)
  return sortByGoalBias(result, goal)
}
