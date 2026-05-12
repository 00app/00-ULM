/**
 * Data version for Zero Zero — when this changes in production, local data is reset
 * and returning users load from session/IP-based storage.
 */
export const DATA_VERSION = process.env.NEXT_PUBLIC_DATA_VERSION ?? '2026-2'

export const LOCAL_STORAGE_KEYS = {
  VERSION: 'zz_data_version',
  PROFILE_NAME: 'profile_name',
  PROFILE_POSTCODE: 'profile_postcode',
  PROFILE_HOUSEHOLD: 'profile_household',
  PROFILE_HOME_TYPE: 'profile_home_type',
  PROFILE_TRANSPORT: 'profile_transport',
  PROFILE_AGE: 'profile_age',
  PROFILE_EMPLOYMENT_STATUS: 'profile_employment_status',
  COMPLETED_JOURNEYS: 'completedJourneys',
  HERO_TOTALS: 'heroTotals',
  UNLOCKED_COUNT: 'zoneUnlockedCount',
  USER_ID: 'userId',
  USER_ID_ALT: 'user_id',
  USER_EMAIL: 'userEmail',
} as const

const JOURNEY_PREFIX = 'journey_'
const JOURNEY_SUFFIX = '_answers'

/** Keys to clear when resetting local data (live deploy). */
export function getLocalDataKeysToReset(): string[] {
  if (typeof window === 'undefined') return []
  const keys: string[] = [
    LOCAL_STORAGE_KEYS.VERSION,
    LOCAL_STORAGE_KEYS.PROFILE_NAME,
    LOCAL_STORAGE_KEYS.PROFILE_POSTCODE,
    LOCAL_STORAGE_KEYS.PROFILE_HOUSEHOLD,
    LOCAL_STORAGE_KEYS.PROFILE_HOME_TYPE,
    LOCAL_STORAGE_KEYS.PROFILE_TRANSPORT,
    LOCAL_STORAGE_KEYS.PROFILE_AGE,
    LOCAL_STORAGE_KEYS.PROFILE_EMPLOYMENT_STATUS,
    LOCAL_STORAGE_KEYS.COMPLETED_JOURNEYS,
    LOCAL_STORAGE_KEYS.HERO_TOTALS,
    LOCAL_STORAGE_KEYS.UNLOCKED_COUNT,
    LOCAL_STORAGE_KEYS.USER_ID,
    LOCAL_STORAGE_KEYS.USER_ID_ALT,
    LOCAL_STORAGE_KEYS.USER_EMAIL,
  ]
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(JOURNEY_PREFIX) && k?.endsWith(JOURNEY_SUFFIX)) keys.push(k)
  }
  return keys
}

export function clearLocalDataAndSetVersion(version: string): void {
  if (typeof window === 'undefined') return
  getLocalDataKeysToReset().forEach((k) => localStorage.removeItem(k))
  localStorage.setItem(LOCAL_STORAGE_KEYS.VERSION, version)
}

export function getStoredDataVersion(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LOCAL_STORAGE_KEYS.VERSION)
}
