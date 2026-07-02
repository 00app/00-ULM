import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { LOCAL_STORAGE_KEYS } from '@/lib/dataVersion'

/** Apply /api/session-state payload into localStorage (profile + journeys). */
export function applySessionStatePayload(data: Record<string, unknown> | null): void {
  if (!data || typeof data !== 'object') return
  const { profile, journeyAnswers, completedJourneys } = data as {
    profile?: Record<string, string>
    journeyAnswers?: Record<string, Record<string, string>>
    completedJourneys?: string[]
  }

  // Fill gaps, never clobber: a stale/empty server session snapshot (e.g. read racing just
  // ahead of the fire-and-forget POST that persists it) must not erase profile fields the user
  // just submitted locally. Only apply a server value when it is non-empty.
  const setIfNonEmpty = (key: string, value: unknown) => {
    const t = value == null ? '' : String(value).trim()
    if (t) localStorage.setItem(key, t)
  }

  if (profile && typeof profile === 'object') {
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_NAME, profile.name)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_POSTCODE, profile.postcode)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_HOUSEHOLD, profile.household)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_HOME_TYPE, profile.home_type)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_TRANSPORT, profile.transport)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_AGE, profile.age)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_EMPLOYMENT_STATUS, profile.employment_status)
    setIfNonEmpty(LOCAL_STORAGE_KEYS.PROFILE_HOME_POWER, profile.home_power)
    setIfNonEmpty('profile_goal', profile.goal)
  }

  if (journeyAnswers && typeof journeyAnswers === 'object') {
    JOURNEY_ORDER.forEach((jid) => {
      const a = journeyAnswers[jid as JourneyId]
      if (a && typeof a === 'object' && Object.keys(a).length > 0) {
        localStorage.setItem(`journey_${jid}_answers`, JSON.stringify(a))
      }
    })
  }

  if (Array.isArray(completedJourneys) && completedJourneys.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.COMPLETED_JOURNEYS, JSON.stringify(completedJourneys))
  }

  window.dispatchEvent(new Event('storage'))
}
