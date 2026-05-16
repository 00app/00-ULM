'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Logo } from '@/app/components/Logo'

type Props = {
  active?: boolean
  className?: string
}

/** Inline Zone pulse — sits above Saving Tips while research hydrates (not a fullscreen gate). */
export function LoadingHeartbeat({ active = true, className = '' }: Props) {
  const reduceMotion = useReducedMotion()
  if (!active) return null

  return (
    <div
      className={`zone-loading-heartbeat flex flex-col items-center justify-center w-full py-4 ${className}`.trim()}
      aria-live="polite"
      aria-busy
      aria-label="Loading your savings wall"
    >
      <motion.div
        animate={reduceMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <Logo width={56} className="zone-loading-heartbeat-logo" style={{ color: 'var(--color-yellow)' }} />
      </motion.div>
    </div>
  )
}
