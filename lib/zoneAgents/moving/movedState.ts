/**
 * "Just moved in" — the life event that switches the Moving Home agent on. Set when someone picks
 * JUST MOVED IN on the energy supplier question (or starts a move on the agent page). Local only:
 * signed-in progress lives in household_moves, this just says when the move happened.
 */

export const MOVED_AT_STORAGE_KEY = 'profile_moved_at'

/** How long after a move the agent stays on Zone. */
export const JUST_MOVED_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** Record the move (today, ISO date). Keeps an earlier date if one is already set. */
export function markJustMoved(now: Date = new Date()): void {
  if (typeof window === 'undefined') return
  try {
    if (readMovedAt()) return
    localStorage.setItem(MOVED_AT_STORAGE_KEY, now.toISOString().slice(0, 10))
  } catch {
    /* storage blocked */
  }
}

export function readMovedAt(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(MOVED_AT_STORAGE_KEY)?.trim() ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

/** True when `movedAt` (YYYY-MM-DD) is within the window ending `now`. Pure, for tests. */
export function isWithinJustMovedWindow(movedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!movedAt || !/^\d{4}-\d{2}-\d{2}$/.test(movedAt)) return false
  const t = Date.parse(`${movedAt}T00:00:00Z`)
  if (!Number.isFinite(t)) return false
  const age = now.getTime() - t
  return age >= -DAY_MS && age <= JUST_MOVED_WINDOW_DAYS * DAY_MS
}

export function isRecentlyMoved(now: Date = new Date()): boolean {
  return isWithinJustMovedWindow(readMovedAt(), now)
}
