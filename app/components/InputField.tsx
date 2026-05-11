'use client'

import React, { KeyboardEvent, FocusEvent } from 'react'

interface InputFieldProps {
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onAdvance?: () => void
  type?: 'text' | 'number' | 'email' | 'password' | 'tel'
  width?: string | number
  className?: string
  /** Focus this input when mounted (e.g. first field in a form) */
  autoFocus?: boolean
}

export default function InputField({
  value = '',
  placeholder,
  onChange,
  onAdvance,
  type = 'text',
  width,
  className,
  autoFocus = false,
}: InputFieldProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value?.trim() && onAdvance) onAdvance()
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  return (
    <input
      type={
        type === 'number'
          ? 'text'
          : type === 'email'
            ? 'email'
            : type === 'password'
              ? 'password'
              : type === 'tel'
                ? 'tel'
                : 'text'
      }
      inputMode={type === 'tel' ? 'tel' : undefined}
      autoComplete={type === 'tel' ? 'tel-national' : undefined}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`zz-input ${className ?? ''}`.trim()}
      style={{
        width: width ?? '100%',
        maxWidth: 360,
        textAlign: 'center',
      }}
    />
  )
}
