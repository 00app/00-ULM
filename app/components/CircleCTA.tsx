'use client'

import React from 'react'

interface CircleCTAProps {
  onClick?: () => void
  disabled?: boolean
  variant?: 'arrow' | 'text' | 'icon'
  text?: string
  icon?: 'heart'
  primary?: boolean         // Sheet primary CTA: blue bg, deep hover
  style?: React.CSSProperties
}

/**
 * CircleCTA — ZERO ZERO ONLY BUTTON
 *
 * Size: 80×80
 * Shape: Circle
 *
 * States:
 * - Default:   COOL bg / BLUE text
 * - Hover:     BLUE bg / ICE text
 * - Active:    DEEP bg / ICE text
 * - Completed: ICE bg / PINK text
 *
 * No borders. No shadows. No scale. Ever.
 */
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
        transition: 'background var(--btn-speed) var(--btn-ease), color var(--btn-speed) var(--btn-ease), border-radius var(--btn-speed) var(--btn-ease)',
        ...style,
      }}
      aria-disabled={disabled}
      onMouseEnter={!disabled && primary ? (e) => {
        e.currentTarget.style.background = 'var(--color-deep)'
        e.currentTarget.style.color = 'var(--color-ice)'
      } : undefined}
      onMouseLeave={!disabled && primary ? (e) => {
        e.currentTarget.style.background = 'var(--color-blue)'
        e.currentTarget.style.color = 'var(--color-ice)'
      } : undefined}
    >
      {variant === 'arrow' ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      ) : variant === 'icon' && icon === 'heart' ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ) : (
        <span>{text}</span>
      )}
    </button>
  )
}
