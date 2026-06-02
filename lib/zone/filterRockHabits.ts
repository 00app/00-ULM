import type { RockHabit } from '@/lib/rock/types'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { normalizeCardHeadlineKey } from '@/lib/soloFocusCopy'

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
  const out: RockHabit[] = []
  for (const h of habits) {
    const key = normalizeCardHeadlineKey(h.title)
    if (!key || blocked.has(key) || seenRock.has(key)) continue
    seenRock.add(key)
    out.push(h)
  }
  return out
}
