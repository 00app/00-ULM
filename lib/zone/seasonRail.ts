import type { RockHabit } from '@/lib/rock/types'
import { getUkSeason, type UkSeason } from '@/lib/zone/seasonHint'

/** In-season = 0, year-round neutral = 1, off-season = 2. */
export type RockHabitSeasonRank = 0 | 1 | 2

export const ROCK_VISIBLE_TIP_COUNT = 6
export const ROCK_SEASON_BOOST_SLOTS = 2

export function rockHabitSeasonRank(habit: RockHabit, season: UkSeason): RockHabitSeasonRank {
  const tags = habit.seasons
  if (!tags || tags.length === 0) return 1
  if (tags.includes(season)) return 0
  return 2
}

/** Stable sort — in-season first, then neutral, then off-season. */
export function sortRockHabitsBySeasonStable(habits: readonly RockHabit[], season: UkSeason): RockHabit[] {
  return habits
    .map((h, index) => ({ h, index, rank: rockHabitSeasonRank(h, season) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ h }) => h)
}

function countInSeason(habits: readonly RockHabit[], season: UkSeason): number {
  return habits.filter((h) => rockHabitSeasonRank(h, season) === 0).length
}

function findDemoteIndex(visible: readonly RockHabit[], season: UkSeason): number {
  for (let i = visible.length - 1; i >= 0; i--) {
    if (rockHabitSeasonRank(visible[i]!, season) === 2) return i
  }
  for (let i = visible.length - 1; i >= 0; i--) {
    if (rockHabitSeasonRank(visible[i]!, season) === 1) return i
  }
  return -1
}

/**
 * Prefer up to `seasonSlots` in-season tips in the visible window without hiding any habit.
 * Off-season tips rank lower; year-round tips stay eligible throughout.
 */
export function prioritizeSeasonTipsForVisibleRail(
  habits: readonly RockHabit[],
  season: UkSeason = getUkSeason(),
  visibleCount = ROCK_VISIBLE_TIP_COUNT,
  seasonSlots = ROCK_SEASON_BOOST_SLOTS
): RockHabit[] {
  if (habits.length <= 1 || seasonSlots <= 0 || visibleCount <= 0) {
    return [...habits]
  }

  const sorted = sortRockHabitsBySeasonStable(habits, season)
  if (sorted.length <= visibleCount) return sorted

  const visible = sorted.slice(0, visibleCount)
  const rest = sorted.slice(visibleCount)

  if (countInSeason(visible, season) >= seasonSlots || countInSeason(rest, season) === 0) {
    return sorted
  }

  const nextVisible = [...visible]
  const nextRest = [...rest]

  while (countInSeason(nextVisible, season) < seasonSlots && countInSeason(nextRest, season) > 0) {
    const promoIdx = nextRest.findIndex((h) => rockHabitSeasonRank(h, season) === 0)
    if (promoIdx < 0) break

    const demoteIdx = findDemoteIndex(nextVisible, season)
    if (demoteIdx < 0) break

    const [promoted] = nextRest.splice(promoIdx, 1)
    if (!promoted) break

    const [demoted] = nextVisible.splice(demoteIdx, 1)
    if (!demoted) break

    nextVisible.push(promoted)
    nextRest.unshift(demoted)
  }

  return [...sortRockHabitsBySeasonStable(nextVisible, season), ...nextRest]
}
