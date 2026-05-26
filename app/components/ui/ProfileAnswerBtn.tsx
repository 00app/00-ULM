'use client'

import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import {
  familyAtomicProps,
  familyControlDelaySec,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

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
  const delay = delaySeconds ?? familyControlDelaySec(optionIndex)
  const enterMotion = familyAtomicProps(Boolean(reduceMotion))
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      className={`profile-answer-btn zz-shimmer-cta ${className}`.trim()}
      style={style}
      disabled={disabled}
      initial={enterMotion.initial}
      animate={enterMotion.animate}
      transition={{
        ...FAMILY_TRANSITION_ATOMIC,
        delay,
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
