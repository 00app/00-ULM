'use client'

import { useEffect, useState } from 'react'

/** True when viewport is at least `minPx` wide (after mount). */
export function useViewportMinWidth(minPx: number): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [minPx])
  return matches
}
