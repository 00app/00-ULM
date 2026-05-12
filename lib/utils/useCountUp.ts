'use client'

import { useState, useEffect, useRef } from 'react'

export interface UseCountUpOptions {
  duration?: number
  decimals?: number
  /** Slight overshoot then settle — reads “springy” when hero totals jump (e.g. Rock Like). */
  spring?: boolean
}

function easeOutBack(t: number): number {
  const c1 = 1.525
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/**
 * Slot-machine style count-up: animates from 0 (or previous value) to target.
 * Returns the current displayed value for use in hero / oversized data.
 */
export function useCountUp(
  value: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 800, decimals = 0, spring = false } = options
  const [display, setDisplay] = useState(value)
  const prevValue = useRef(value)
  const startTime = useRef<number | null>(null)
  const startValue = useRef(value)
  const raf = useRef<number>(0)

  useEffect(() => {
    const target = value
    if (target === prevValue.current) return
    startValue.current = display
    prevValue.current = target
    startTime.current = null

    const tick = (now: number) => {
      if (startTime.current == null) startTime.current = now
      const elapsed = now - startTime.current
      const t = Math.min(elapsed / duration, 1)
      const blend = spring
        ? t >= 1
          ? 1
          : Math.max(0, easeOutBack(t))
        : 1 - (1 - t) * (1 - t)
      const current =
        Math.round((startValue.current + (target - startValue.current) * blend) * 10 ** decimals) /
        10 ** decimals
      setDisplay(current)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // display is read only to set startValue for animation; omit to avoid re-running on every tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals, spring])

  return display
}
