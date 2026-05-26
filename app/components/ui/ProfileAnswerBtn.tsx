'use client'

import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import {
  FAMILY_BLUR_PX,
  FAMILY_DUR_SHORT,
  FAMILY_EASE,
  FAMILY_GLIDE_PX,
  familyControlDelaySec,
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
  const initial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: FAMILY_GLIDE_PX * 0.35, filter: `blur(${FAMILY_BLUR_PX * 0.5}px)` }
  const animate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, x: 0, filter: 'blur(0px)' }
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
        duration: FAMILY_DUR_SHORT,
        delay,
        ease: FAMILY_EASE,
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  )
}
