'use client'

import { useEffect, useRef } from 'react'
import {
  DATA_VERSION,
  getStoredDataVersion,
  clearLocalDataAndSetVersion,
} from '@/lib/dataVersion'
import { ensureSessionBootstrap, SESSION_BOOTSTRAP_EVENT } from '@/lib/client/protectedRouteGate'
import { applySessionStatePayload } from '@/lib/client/sessionRehydrateApply'

/**
 * On version bump: reset local storage, bootstrap session cookie, rehydrate profile/journey answers.
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

    const loadPayload = () =>
      fetch('/api/session-state', { credentials: 'include', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => applySessionStatePayload(data as Record<string, unknown> | null))
        .catch(() => {})

    void ensureSessionBootstrap().then((result) => {
      if (result.sessionReady) void loadPayload()
    })

    const onBootstrap = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionReady?: boolean }>).detail
      if (detail?.sessionReady) void loadPayload()
    }
    window.addEventListener(SESSION_BOOTSTRAP_EVENT, onBootstrap as EventListener)
    return () => {
      window.removeEventListener(SESSION_BOOTSTRAP_EVENT, onBootstrap as EventListener)
    }
  }, [])

  return null
}
