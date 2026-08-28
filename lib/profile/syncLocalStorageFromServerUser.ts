import { PROFILE_GOAL_STORAGE_KEY, PROFILE_STORAGE_KEYS } from '@/lib/profile/onboardingComplete'

/**
 * Write a server `users` row (same shape /api/user returns) into the same localStorage keys
 * onboarding itself writes to. Needed anywhere a session can start existing on a device whose
 * localStorage never saw that account's answers — onboarding's own final step (the account was
 * just created here, so nothing to sync from elsewhere) and login on a fresh device (the account
 * is old, but this browser's localStorage is empty). Without this, state.profile (AppContext,
 * sourced from localStorage) stays empty and the whole app reads as "Guest" even though the
 * session is genuinely authenticated.
 */
export function syncLocalStorageFromServerUser(user: Record<string, unknown> | undefined | null): void {
  if (!user || typeof window === 'undefined') return
  const setIfString = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) localStorage.setItem(key, value)
  }
  setIfString(PROFILE_STORAGE_KEYS.name, user.name)
  setIfString(PROFILE_STORAGE_KEYS.postcode, user.postcode)
  setIfString(PROFILE_STORAGE_KEYS.livingSituation, user.household)
  setIfString(PROFILE_STORAGE_KEYS.homeType, user.home_type)
  setIfString(PROFILE_STORAGE_KEYS.transport, user.transport_baseline)
  setIfString(PROFILE_STORAGE_KEYS.age, user.age_group)
  setIfString(PROFILE_STORAGE_KEYS.employmentStatus, user.employment_status)
  const genome = user.user_genome && typeof user.user_genome === 'object'
    ? (user.user_genome as Record<string, unknown>)
    : null
  if (genome) {
    setIfString(PROFILE_STORAGE_KEYS.powerType, genome.home_power)
    setIfString(PROFILE_STORAGE_KEYS.homeOwnership, genome.home_ownership)
    setIfString(PROFILE_STORAGE_KEYS.washPreference, genome.wash_preference)
    setIfString(PROFILE_STORAGE_KEYS.flightFrequency, genome.flight_frequency)
    setIfString(PROFILE_STORAGE_KEYS.financialPressure, genome.financial_pressure)
    setIfString(PROFILE_STORAGE_KEYS.children, genome.children)
    setIfString(PROFILE_STORAGE_KEYS.helpGoal, genome.help_goal)
    const goal = genome.profile_goal ?? genome.goal
    if (typeof goal === 'string' && goal.trim()) {
      try {
        localStorage.setItem(PROFILE_GOAL_STORAGE_KEY, goal)
      } catch {
        /* ignore */
      }
    }
  }
}
