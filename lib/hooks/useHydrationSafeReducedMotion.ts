'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** SSR + first client paint share `false`; syncs to `prefers-reduced-motion` after mount (avoids hydration mismatch). */
export function useHydrationSafeReducedMotion(): boolean {
  const prefers = useReducedMotion()
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    setReduceMotion(Boolean(prefers))
  }, [prefers])
  return reduceMotion
}
