'use client'

import React, { KeyboardEvent } from 'react'

interface InputFieldProps {
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onAdvance?: () => void
  type?: 'text' | 'number' | 'email' | 'password'
  /** Override default width; use '100%' inside auth modal for containment */
  width?: string | number
  className?: string
}

/**
 * InputField — Zero Zero
 *
 * Rules:
 * - NO number spinners
 * - Keyboard entry only
 * - ENTER advances
 * - Arrow CTA appears only when filled
 * - Same behaviour across text & number
 */
export default function InputField({
  value = '',
  placeholder,
  onChange,
  onAdvance,
  type = 'text',
  width,
  className,
}: InputFieldProps) {
  const filled = Boolean(value && value.length > 0)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filled && onAdvance) {
      onAdvance()
    }
  }

  const baseWidth = 350
  const extendedWidth = baseWidth * 1.5
  const resolvedWidth = width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : extendedWidth

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        width: resolvedWidth,
        maxWidth: '100%',
        height: 60,
        padding: '0 20px',
        alignItems: 'center',
        borderRadius: 30,
        background: 'var(--color-cool)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <input
        type={type === 'number' ? 'text' : (type === 'email' ? 'email' : type === 'password' ? 'password' : 'text')}
        inputMode={type === 'number' ? 'numeric' : undefined}
        pattern={type === 'number' ? '[0-9]*' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--color-blue)',
          fontFamily: 'Roboto',
          fontSize: 40,
          lineHeight: '38px',
          letterSpacing: '-2px',
          fontWeight: 900,
          textTransform: 'lowercase',
          padding: 0,
          paddingRight: filled && onAdvance ? 50 : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {filled && onAdvance && (
        <button
          className="input-arrow-button"
          onClick={onAdvance}
          style={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 30,
            height: 30,
            borderRadius: 15,
            background: 'var(--color-cool)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-blue)',
            cursor: 'pointer',
            flexShrink: 0,
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-deep)'
            e.currentTarget.style.color = 'var(--color-ice)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-cool)'
            e.currentTarget.style.color = 'var(--color-blue)'
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
