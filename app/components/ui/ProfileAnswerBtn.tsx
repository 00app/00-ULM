'use client'

import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { INTRO_DECISION_CTA_TRANSITION } from '@/lib/animations'

const PROFILE_BUTTON_TAP = { scale: 0.94 }

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
 * v6.1 — 100×100 profile option / continue circle: elastic bloom (scale 0→1),
 * `INTRO_DECISION_CTA_TRANSITION` (520/28), stagger via `optionIndex` or `delaySeconds`.
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
  const delay = delaySeconds ?? (optionIndex + 1) * 0.1
  const initial = reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 1 }
  const animate = reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      className={`profile-answer-btn zz-shimmer-cta ${className}`.trim()}
      style={style}
      disabled={disabled}
      initial={initial}
      animate={animate}
      transition={{ ...INTRO_DECISION_CTA_TRANSITION, delay }}
      onClick={onClick}
      whileTap={PROFILE_BUTTON_TAP}
    >
      {children}
    </motion.button>
  )
}
