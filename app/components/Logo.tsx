'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { GLITCH_ANIM_MS } from '@/lib/architecturalPulse'

export interface LogoProps {
  width?: number
  className?: string
  style?: React.CSSProperties
}

/** Zone anchor brand mark — pass `className` (e.g. `text-yellow`) or `style.color` for the lock palette. */
export function Logo({ width = 51, className = '', style }: LogoProps) {
  return (
    <svg
      width={width}
      viewBox="0 0 126 200"
      fill="none"
      className={className}
      style={{ width, height: 'auto', ...style }}
      aria-hidden
    >
      <path
        d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z"
        fill="currentColor"
      />
      <path
        d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z"
        fill="currentColor"
      />
      <path
        d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411"
        fill="currentColor"
      />
    </svg>
  )
}

type GlitchLogoProps = {
  width?: number
  onComplete?: () => void
  loop?: boolean
  className?: string
}

/** Style A glitch — yellow base + pink overlay (469ms). */
export function GlitchLogo({ width = 126, onComplete, loop = false, className = '' }: GlitchLogoProps) {
  const reduceMotion = useHydrationSafeReducedMotion()
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const [tick, setTick] = useState(0)
  const height = Math.round(width * (200 / 126))

  useEffect(() => {
    if (reduceMotion) {
      onCompleteRef.current?.()
      return
    }
    const id = window.setInterval(() => {
      setTick((t) => t + 1)
      onCompleteRef.current?.()
      if (!loop) window.clearInterval(id)
    }, GLITCH_ANIM_MS)
    return () => window.clearInterval(id)
  }, [loop, reduceMotion, width])

  if (reduceMotion) {
    return (
      <div className={`zz-glitch-wrap ${className}`.trim()} aria-hidden>
        <Logo width={width} style={{ color: 'var(--color-yellow)' }} />
      </div>
    )
  }

  return (
    <div className={`zz-glitch-wrap ${className}`.trim()} aria-hidden>
      <div className="zz-glitch" style={{ width, height }} key={tick}>
        <Logo width={width} className="glitch-layer base" style={{ color: 'var(--color-yellow)', position: 'absolute', inset: 0 }} />
        <Logo width={width} className="glitch-layer purple" style={{ color: 'var(--color-pink)', position: 'absolute', inset: 0 }} />
      </div>
    </div>
  )
}
