'use client'

import { useEffect } from 'react'

const SESSION_WAKE_KEY = 'zz_neon_wake_v1'
const WAKE_ATTEMPTS = 4
const WAKE_DELAY_MS = 2_500

/** Fire GET /api/health once per tab session so suspended Neon compute wakes before DB routes. */
export default function NeonWakePing() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(SESSION_WAKE_KEY) === '1') return
    } catch {
      // ignore private mode / blocked storage
    }

    let cancelled = false

    const wake = async () => {
      for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
        if (cancelled) return
        try {
          const res = await fetch('/api/health', { cache: 'no-store' })
          if (res.ok) {
            try {
              sessionStorage.setItem(SESSION_WAKE_KEY, '1')
            } catch {
              // ignore
            }
            return
          }
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

    void wake()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
