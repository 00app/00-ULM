'use client'

import React from 'react'

interface AnswerCircleProps {
  text: string
  selected?: boolean
  onClick?: () => void
  autoAdvance?: boolean // If true, onClick automatically advances
  /** When true (e.g. electricity/gas provider options): 2-line centred, no overflow. Only on these buttons. */
  twoLine?: boolean
}

/**
 * AnswerCircle - For ≤9 option answers
 * - Circular shape
 * - Uppercase label typography
 * - Tap = auto-advance (if autoAdvance is true)
 * - No CTA arrow needed
 */
export default function AnswerCircle({ 
  text, 
  selected = false, 
  onClick,
  autoAdvance = true,
  twoLine = false,
}: AnswerCircleProps) {
  const handleClick = () => {
    onClick?.()
    // Auto-advance logic would be handled by parent
  }

  // Energy provider options: 2 lines centred, no overflow. Split on underscore (e.g. BRITISH_GAS → BRITISH\nGAS).
  const displayText = twoLine && text.includes('_')
    ? text.split('_').join('\n')
    : text

  return (
    <button
      className={`answer-circle zz-button ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      style={{
        display: 'flex',
        width: 80,
        height: 80,
        padding: '4px 6px',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 40,
        border: 'none',
        background: selected 
          ? 'var(--color-blue)' 
          : 'var(--btn-bg-rest)',
        color: selected 
          ? 'var(--color-ice)' 
          : 'var(--btn-text-rest)',
        fontFamily: 'Roboto',
        fontSize: 10,
        lineHeight: '14px',
        letterSpacing: '0.6px',
        fontWeight: 900,
        textTransform: 'uppercase',
        cursor: 'pointer',
        whiteSpace: twoLine ? 'pre-line' : 'nowrap',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {displayText}
    </button>
  )
}
