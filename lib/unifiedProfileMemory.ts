/**
 * Single local snapshot: onboarding profile keys + all journey_*_answers for Zai / Solo Focus / recall.
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

export const UNIFIED_PROFILE_MEMORY_KEY = 'zz_user_profile_memory_v1'
export const USER_PROFILE_KEY = 'user_profile'

export const UNIFIED_PROFILE_MEMORY_EVENT = 'zz-unified-profile-memory'

export interface UnifiedProfileMemory {
  updatedAt: number
  profile: Record<string, string>
  journeyAnswers: Record<JourneyId, Record<string, string>>
}

function readProfileKeys(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const keys = [
    ['name', 'profile_name'],
    ['postcode', 'profile_postcode'],
    ['house_number', 'profile_house_number'],
    ['household', 'profile_household'],
    ['home_type', 'profile_home_type'],
    ['home_power', 'profile_home_power'],
    ['transport', 'profile_transport'],
    ['age', 'profile_age'],
    ['employment_status', 'profile_employment_status'],
    ['goal', 'profile_goal'],
  ] as const
  const out: Record<string, string> = {}
  for (const [k, storageKey] of keys) {
    out[k] = localStorage.getItem(storageKey) ?? ''
  }
  return out
}

function readAllJourneyAnswers(): Record<JourneyId, Record<string, string>> {
  const out = {} as Record<JourneyId, Record<string, string>>
  if (typeof window === 'undefined') return out
  for (const jid of JOURNEY_ORDER) {
    try {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      out[jid] = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      out[jid] = {}
    }
  }
  return out
}

/** Persist merged profile + journey answers and notify listeners (AppContext / Zai clients). */
export function persistUnifiedUserProfileMemory(): void {
  if (typeof window === 'undefined') return
  try {
    const profile = readProfileKeys()
    const payload: UnifiedProfileMemory = {
      updatedAt: Date.now(),
      profile,
      journeyAnswers: readAllJourneyAnswers(),
    }
    localStorage.setItem(UNIFIED_PROFILE_MEMORY_KEY, JSON.stringify(payload))
    localStorage.setItem(
      USER_PROFILE_KEY,
      JSON.stringify({
        updatedAt: payload.updatedAt,
        ...profile,
        journey_answers_jsonb: payload.journeyAnswers,
      })
    )
    window.dispatchEvent(new Event(UNIFIED_PROFILE_MEMORY_EVENT))
  } catch {
    // ignore quota / privacy mode
  }
}
