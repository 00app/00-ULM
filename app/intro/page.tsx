'use client'

/**
 * v6 — Kinetic shimmer: intro words use lens-focus (`lensFocusShimmer` + `.zz-shimmer-focus`);
 * decision uses simultaneous headline shimmer + staggered CTA bloom — see `IntroScreen` / `IntroWordCycle` / `globals.css`.
 */
import IntroScreen from '@/app/components/IntroScreen'
import { useEffect } from 'react'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'

export default function IntroPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let prev = (window.localStorage.getItem('profile_postcode') ?? '').trim().toUpperCase()
    let seq = 0
    const id = window.setInterval(() => {
      const next = (window.localStorage.getItem('profile_postcode') ?? '').trim().toUpperCase()
      if (!next || next === prev) return
      prev = next
      const currentSeq = ++seq
      void fetch('/api/local-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcode: next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('local-intelligence failed')
          return res.json()
        })
        .then(() => {
          // Dispatch unified profile memory event only after postcode geocode resolves.
          if (currentSeq === seq) persistUnifiedUserProfileMemory()
        })
        .catch(() => {
          // Keep memory fresh even when geocode endpoint degrades.
          if (currentSeq === seq) persistUnifiedUserProfileMemory()
        })
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  return <IntroScreen />
}
