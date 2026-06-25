/**
 * Profile goal preference — intro sets `profile_goal`; settings can change it anytime.
 * Goal affects sort priority, scrape seeds, loop picks, and copy emphasis — never hides carbon metrics.
 */

import type { ProfileGoalValue } from '@/lib/profile/goalWeighting'
import { normalizeProfileGoalValue } from '@/lib/profile/goalWeighting'
import { readProfileFieldsFromStorage, safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'
import { resolveAffluenceAuditMode, mapProfileGoalToPrimaryGoal, type AffluenceAuditMode } from '@/lib/zone/affluenceCheck'

export const PROFILE_GOAL_STORAGE_KEY = 'profile_goal'

/** Effective goal for intelligence routing (intro + settings share one key). */
export function readEffectiveProfileGoal(): ProfileGoalValue {
  const stored = readProfileFieldsFromStorage()
  return normalizeProfileGoalValue(stored.goal ?? safeGetItem(PROFILE_GOAL_STORAGE_KEY))
}

export function persistProfileGoal(value: ProfileGoalValue): void {
  if (typeof window === 'undefined') return
  safeSetItem(PROFILE_GOAL_STORAGE_KEY, value)
  try {
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('profile-goal-changed'))
  } catch {
    /* ignore */
  }
  void import('@/lib/sessionStateSync').then((m) => m.syncSessionState()).catch(() => undefined)
}

export function profileGoalForServerSync(value: ProfileGoalValue): {
  profile_goal: ProfileGoalValue
  primary_goal: ReturnType<typeof mapProfileGoalToPrimaryGoal>
} {
  return {
    profile_goal: value,
    primary_goal: mapProfileGoalToPrimaryGoal(value),
  }
}

/** Goal + affluence tone for loop picks and scrape routing. */
export function readProfileSegmentContext(): {
  goal: ProfileGoalValue
  toneMode: AffluenceAuditMode
} {
  const stored = readProfileFieldsFromStorage()
  const goal = readEffectiveProfileGoal()
  const { mode } = resolveAffluenceAuditMode({
    employment_status: stored.employment_status,
    postcode: stored.postcode,
    household_income_bracket: stored.household_income_bracket,
    primary_goal: goal,
  })
  return { goal, toneMode: mode }
}
