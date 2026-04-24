'use client'

import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import type { RockHabit } from '@/lib/rock/types'
import { syncRockRotation } from '@/lib/rock/rotation'

/**
 * Client-only: six visible Rock habits, daily UTC trickle, persisted in localStorage.
 * `refreshKey` — bump when a slot is replaced after Like (zip-shutter).
 */
export function useRockVisibleHabits(
  likedCardIds: readonly string[],
  seed: string,
  refreshKey: number
): RockHabit[] {
  const [habits, setHabits] = useState<RockHabit[]>([])
  const likedKey = [...likedCardIds].sort().join('\u0001')

  const pull = useCallback(() => {
    void refreshKey
    const ids = likedKey.length ? likedKey.split('\u0001') : []
    setHabits(syncRockRotation(ids, seed))
  }, [likedKey, seed, refreshKey])

  /** Sync before paint so the strip is not empty on first meaningful frame (loop feels “live”). */
  useLayoutEffect(() => {
    pull()
  }, [pull])

  useEffect(() => {
    const id = setInterval(pull, 60_000)
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') pull()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [pull])

  return habits
}
