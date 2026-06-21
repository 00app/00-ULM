'use client'

import { useEffect } from 'react'

const WAKE_ATTEMPTS = 4
const WAKE_DELAY_MS = 2_500
const VISIBILITY_DEBOUNCE_MS = 800

/** Ping /api/health so suspended Neon compute wakes before DB routes. */
async function wakeNeon(): Promise<void> {
  for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (res.ok) return
      if (res.status === 503 && attempt < WAKE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
        continue
      }
      return
    } catch {
      if (attempt < WAKE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
      }
    }
  }
}

export default function NeonWakePing() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null

    const runWake = () => {
      if (cancelled) return
      void wakeNeon()
    }

    runWake()

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (visibilityTimer) clearTimeout(visibilityTimer)
      visibilityTimer = setTimeout(runWake, VISIBILITY_DEBOUNCE_MS)
    }

    window.addEventListener('focus', runWake)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (visibilityTimer) clearTimeout(visibilityTimer)
      window.removeEventListener('focus', runWake)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
