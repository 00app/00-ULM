'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

interface AnswerCircleProps {
  text: string
  selected: boolean
  onClick: () => void
  autoAdvance?: boolean
  twoLine?: boolean
  /** Two-colour rule (onboarding): rest/hover reversed; restColor = text (yellow), restBg = fill; hover = restColor fill + restBg text */
  theme?: { restBg: string; restColor: string; selectedBg: string; selectedColor: string }
}

export default function AnswerCircle({
  text,
  selected,
  onClick,
  twoLine,
  theme,
}: AnswerCircleProps) {
  const [hovered, setHovered] = useState(false)
  const displayText = twoLine ? text.replace('_', '\n') : text

  const bg = theme
    ? (selected ? theme.selectedBg : hovered ? theme.restColor : theme.restBg)
    : (selected ? 'var(--color-purple)' : 'var(--color-purple)')
  const col = theme
    ? (selected ? theme.selectedColor : hovered ? theme.restBg : theme.restColor)
    : (selected ? 'var(--color-yellow)' : 'var(--color-purple)')

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`answer-circle-100${theme ? '' : ' zz-h4'}`}
      style={{
        padding: 0,
        border: 'none',
        background: bg,
        color: col,
        ...(theme
          ? {
              fontSize: 12,
              lineHeight: 0.85,
              letterSpacing: 'var(--zz-track-circle-marvin)',
              textTransform: 'uppercase' as const,
            }
          : {}),
        whiteSpace: twoLine ? 'pre-line' : 'nowrap',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      transition={INDUSTRIAL_OPACITY_SNAP}
    >
      {displayText}
    </motion.button>
  )
}
