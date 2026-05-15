'use client'

import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { STACCATO_DROP_PX, STACCATO_DURATION_SEC, STACCATO_EASE } from '@/lib/animations'

export type ProfileAnswerBtnProps = {
  reduceMotion: boolean | null | undefined
  /** 0-based; entrance delay defaults to `(optionIndex + 1) * 0.1` seconds */
  optionIndex: number
  /** When set, overrides stagger (e.g. Continue uses `0.1`) */
  delaySeconds?: number
  className: string
  style?: CSSProperties & { '--local-theme'?: string }
  disabled?: boolean
  onClick: () => void
  'aria-label': string
  children: ReactNode
}

/**
 * v6.1 — 100×100 profile option / continue circle: fussy snap reveal.
 */
export default function ProfileAnswerBtn({
  reduceMotion,
  optionIndex,
  delaySeconds,
  className,
  style,
  disabled,
  onClick,
  'aria-label': ariaLabel,
  children,
}: ProfileAnswerBtnProps) {
  const delay = delaySeconds ?? (optionIndex + 1) * STACCATO_DURATION_SEC
  const initial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: STACCATO_DROP_PX }
  const animate = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      className={`profile-answer-btn zz-shimmer-cta ${className}`.trim()}
      style={style}
      disabled={disabled}
      initial={initial}
      animate={animate}
      transition={{
        duration: STACCATO_DURATION_SEC,
        delay,
        ease: STACCATO_EASE,
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
