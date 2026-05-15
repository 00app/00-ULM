'use client'

/**
 * Zero Zero Funky v1.4 — 1. Kinetic Buttons (CTAs & Answers)
 * Rules: zero shadows, 9999px pill radius, 80px circles, Marvin Visions Bold.
 * Framer Motion "Swish" physics baked in; do not redefine.
 */

import { track } from '@vercel/analytics'
import { motion } from 'framer-motion'
import type { JourneyId } from '@/lib/journeys'

import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

export type FunkyCircleCTAVariant = 'primary' | 'journey' | 'secondary'

export interface FunkyCircleCTAProps {
  label: string
  variant?: FunkyCircleCTAVariant
  journeyColor?: JourneyId
  onClick?: () => void
  disabled?: boolean
  className?: string
  /** Icon slot: e.g. heart for LIKE. Renders after label. */
  icon?: React.ReactNode
  /** v1.4: Button labels = Roboto Bold (one-word CLAIM, LIKE, ASK). Default 'marvin'. */
  labelFont?: 'marvin' | 'roboto-bold'
}

/**
 * Zero Zero Funky v1.4 — 80×80px circle CTA.
 * Max 1-word label. Marvin Visions Bold. Squish on tap.
 */
export function FunkyCircleCTA({
  label,
  variant = 'secondary',
  journeyColor,
  onClick,
  disabled = false,
  className = '',
  icon,
  labelFont = 'marvin',
}: FunkyCircleCTAProps) {
  const bg =
    variant === 'primary'
      ? 'var(--color-purple)'
      : variant === 'journey' && journeyColor
        ? `var(--color-j-${journeyColor})`
        : 'var(--color-purple)'
  const color =
    variant === 'primary' || variant === 'journey' ? 'var(--color-yellow)' : 'var(--color-purple)'
  const fontStyle =
    labelFont === 'roboto-bold'
      ? {
          fontFamily: 'var(--font-roboto), sans-serif',
          fontWeight: 800,
          fontSize: 'var(--zz-body-size)',
          lineHeight: 'var(--zz-lh-body)',
          textTransform: 'uppercase' as const,
        }
      : {
          fontFamily: 'var(--font-label)',
          fontWeight: 'bold',
          textTransform: 'uppercase' as const,
        }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      transition={INDUSTRIAL_OPACITY_SNAP}
      className={`flex items-center justify-center rounded-[9999px] border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${labelFont === 'marvin' ? 'zz-h4' : ''} ${className}`}
      style={{
        width: 80,
        height: 80,
        minWidth: 80,
        minHeight: 80,
        background: bg,
        color,
        boxShadow: 'none',
        textShadow: 'none',
        ...fontStyle,
      }}
    >
      {icon ? (
        <span className="flex items-center justify-center gap-1">
          {label}
          {icon}
        </span>
      ) : (
        label
      )}
    </motion.button>
  )
}

/** v1.4 — One-word answer circle (100px). Roboto Bold. Flat cool bg. No shadow. */
export interface FunkyAnswerCircleProps {
  label: string
  onClick?: () => void
  className?: string
}

export function FunkyAnswerCircle({ label, onClick, className = '' }: FunkyAnswerCircleProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      transition={INDUSTRIAL_OPACITY_SNAP}
      className={`flex items-center justify-center rounded-[9999px] border-0 cursor-pointer funky-answer-circle zz-h4 ${className}`}
      style={{
        width: 100,
        height: 100,
        minWidth: 100,
        minHeight: 100,
        background: 'var(--color-purple)',
        color: 'var(--color-yellow)',
        boxShadow: 'none',
        textShadow: 'none',
      }}
    >
      {label}
    </motion.button>
  )
}

export interface FunkyAnswerPillProps {
  label: string
  selected?: boolean
  journeyColor?: string
  onClick?: () => void
  className?: string
}

/**
 * Zero Zero Funky v1.4 — Full-width pill answer. 9999px radius. Selected = journey color + white text.
 */
export function FunkyAnswerPill({
  label,
  selected = false,
  journeyColor = 'var(--color-purple)',
  onClick,
  className = '',
}: FunkyAnswerPillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      transition={INDUSTRIAL_OPACITY_SNAP}
      className={`w-full max-w-[300px] rounded-[9999px] border-0 py-3 px-5 text-left cursor-pointer ${className}`}
      style={{
        background: selected ? journeyColor : 'var(--color-purple)',
        color: selected ? 'var(--color-yellow)' : 'var(--color-purple)',
        boxShadow: 'none',
        textShadow: 'none',
        fontFamily: 'var(--font-label)',
        fontSize: 'var(--zz-h4-mobile)',
        lineHeight: 'var(--zz-lh-heading)',
        fontWeight: 'bold',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </motion.button>
  )
}

export interface IndustrialHandoffButtonProps {
  url: string
  journeyId?: string | null
  moneyValue?: number
  ctaLabel?: string
  className?: string
  /** Pink (default) vs yellow block + journey text (Action Vault rebirth). */
  surface?: 'pink' | 'yellow'
}

export function IndustrialHandoffButton({
  url,
  journeyId,
  moneyValue,
  ctaLabel = 'CLAIM',
  className = '',
  surface = 'pink',
}: IndustrialHandoffButtonProps) {
  const words = ctaLabel.trim().split(/\s+/).filter(Boolean)
  const line1 = words[0] ?? ''
  const line2 = words.length <= 2 ? (words[1] ?? '') : words.slice(1, -1).join(' ')
  const line3 = words.length >= 3 ? words[words.length - 1] : ''

  const handleClick = () => {
    try {
      track('handoff_click', { journey: journeyId || 'unknown', target: url, value: moneyValue || 0 })
    } catch {
      // Ignore if analytics fails
    }
    setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer')
    }, 150)
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'tween', duration: 0.12, ease: 'linear' }}
      className={`circle-btn solo-focus-handoff-btn border-0 cursor-pointer ${className}`.trim()}
      style={{
        backgroundColor: surface === 'yellow' ? 'var(--color-yellow)' : 'var(--color-pink)',
        color: surface === 'yellow' ? 'var(--journey-text)' : 'var(--color-yellow)',
        borderRadius: 60,
        minWidth: 80,
        minHeight: 80,
        fontFamily: 'var(--font-roboto), sans-serif',
        fontWeight: 800,
        fontSize: 16,
        lineHeight: 1.2,
        boxShadow: 'none',
      }}
    >
      <span className="circle-btn-label-stack" aria-hidden="true">
        <span>{line1}</span>
        <span>{line2}</span>
        <span>{line3}</span>
      </span>
    </motion.button>
  )
}
