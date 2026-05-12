'use client'

import { motion } from 'framer-motion'

const SWISH_TRANSITION = { type: 'spring' as const, stiffness: 600, damping: 15 }

export interface FunkyCircleCTAProps {
  label: string
  onClick?: () => void
  bgColor?: string
  /** Label on purple (default yellow). */
  labelColor?: string
  'aria-label'?: string
}

/**
 * 80×80 perfect circle CTA. Zero Zero v1.3 Swish: scaleX 1.15, scaleY 0.85 on tap.
 * No hover effects. No shadows. Marvin Visions.
 */
export function FunkyCircleCTA({
  label,
  onClick,
  bgColor = 'var(--color-purple)',
  labelColor = 'var(--color-yellow)',
  'aria-label': ariaLabel,
}: FunkyCircleCTAProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="zz-label rounded-full flex items-center justify-center cursor-pointer border-none"
      style={{
        width: 80,
        height: 80,
        backgroundColor: bgColor,
        color: labelColor,
        fontSize: 12,
      }}
      whileTap={{
        scaleX: 1.15,
        scaleY: 0.85,
        transition: SWISH_TRANSITION,
      }}
      transition={SWISH_TRANSITION}
    >
      {label}
    </motion.button>
  )
}

export interface FunkyAnswerPillProps {
  label: string
  selected?: boolean
  onClick?: () => void
  journeyColor?: string
}

/**
 * Pill-shaped answer button. Purple default + yellow label; selected = journey surface + purple label.
 * Bounce on tap. No shadows. Marvin Visions Bold.
 */
export function FunkyAnswerPill({
  label,
  selected = false,
  onClick,
  journeyColor = 'var(--color-purple)',
}: FunkyAnswerPillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="rounded-full border-none cursor-pointer font-bold uppercase px-6 py-3 w-full max-w-[300px]"
      style={{
        fontFamily: 'var(--font-label)',
        fontSize: 24,
        lineHeight: 1.2,
        backgroundColor: selected ? journeyColor : 'var(--color-purple)',
        color: selected ? 'var(--color-purple)' : 'var(--color-yellow)',
        borderRadius: 9999,
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {label}
    </motion.button>
  )
}
