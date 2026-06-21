import { ROCK_BY_SLUG, ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import type { RockHabit } from '@/lib/rock/types'
import { getUkSeason } from '@/lib/zone/seasonHint'
import { sortRockHabitsBySeasonStable } from '@/lib/zone/seasonRail'

const DEFAULT_LIMIT = 3

/** Resolve Today's Tips slugs from the Zone rail, or fall back to season-sorted catalog. */
export function pickRockTipsForSms(slugs: string[] | undefined, limit = DEFAULT_LIMIT): RockHabit[] {
  const cap = Math.max(1, Math.min(limit, 6))
  const cleaned = (slugs ?? [])
    .map((s) => s.trim())
    .filter(Boolean)

  if (cleaned.length) {
    const picked: RockHabit[] = []
    const seen = new Set<string>()
    for (const slug of cleaned) {
      const h = ROCK_BY_SLUG.get(slug)
      if (!h || seen.has(h.slug)) continue
      seen.add(h.slug)
      picked.push(h)
      if (picked.length >= cap) break
    }
    if (picked.length) return picked
  }

  const season = getUkSeason()
  return sortRockHabitsBySeasonStable(ROCK_HABITS, season).slice(0, cap)
}
