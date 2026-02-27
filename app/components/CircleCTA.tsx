'use client'

import React from 'react'

interface CircleCTAProps {
  onClick?: () => void
  disabled?: boolean
  variant?: 'arrow' | 'text' | 'icon'
  text?: string
  icon?: 'heart'
  primary?: boolean
  style?: React.CSSProperties
}

export default function CircleCTA({
  onClick,
  disabled = false,
  variant = 'arrow',
  text,
  icon,
  primary = false,
  style,
}: CircleCTAProps) {
  if (variant === 'text' && !text) return null
  if (variant === 'icon' && icon !== 'heart') return null

  const base = disabled
    ? { background: 'var(--color-ice)', color: 'var(--color-deep)' }
    : primary
      ? { background: 'var(--color-blue)', color: 'var(--color-ice)' }
      : { background: style?.background || 'var(--color-cool)', color: style?.color || 'var(--color-blue)' }

  return (
    <button
      className={`circle-cta zz-button${primary ? ' primary' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        border: 'none',
        ...base,
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'Roboto',
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 900,
        letterSpacing: '0',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
        ...style,
      }}
      aria-disabled={disabled}
    >
      {variant === 'arrow' && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {variant === 'text' && text}
      {variant === 'icon' && icon === 'heart' && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )}
    </button>
  )
}
