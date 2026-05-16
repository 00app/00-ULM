'use client'

import { useEffect, useRef } from 'react'
import {
  DATA_VERSION,
  getStoredDataVersion,
  clearLocalDataAndSetVersion,
  LOCAL_STORAGE_KEYS,
} from '@/lib/dataVersion'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'

/**
 * On version bump: reset local + session storage, then rehydrate profile/journey answers from the server.
 */
export default function SessionStateRehydrate() {
  const done = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || done.current) return
    done.current = true

    const storedVersion = getStoredDataVersion()
    if (storedVersion !== DATA_VERSION) {
      clearLocalDataAndSetVersion(DATA_VERSION)
    }

    fetch('/api/session-state', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const { profile, journeyAnswers, completedJourneys } = data
        if (profile && typeof profile === 'object') {
          if (profile.name != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_NAME, String(profile.name))
          if (profile.postcode != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_POSTCODE, String(profile.postcode))
          if (profile.household != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_HOUSEHOLD, String(profile.household))
          if (profile.home_type != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_HOME_TYPE, String(profile.home_type))
          if (profile.transport != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_TRANSPORT, String(profile.transport))
          if (profile.age != null) localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_AGE, String(profile.age))
          if (profile.employment_status != null) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE_EMPLOYMENT_STATUS, String(profile.employment_status))
          }
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
      })
      .catch(() => {})
  }, [])

  return null
}
