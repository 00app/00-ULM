'use client'

import React, { forwardRef, KeyboardEvent, FocusEvent } from 'react'

interface InputFieldProps {
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onAdvance?: () => void
  type?: 'text' | 'number' | 'email' | 'password' | 'tel'
  width?: string | number
  className?: string
  autoFocus?: boolean
  onBlurViewportReset?: () => void
  /** HTML autocomplete token (e.g. `given-name`, `postal-code`). */
  autoComplete?: string
  /** Accessible name for autofill heuristics. */
  name?: string
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    value = '',
    placeholder,
    onChange,
    onAdvance,
    type = 'text',
    width,
    className,
    autoFocus = false,
    onBlurViewportReset,
    autoComplete,
    name,
  },
  ref
) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const live = (e.currentTarget.value ?? '').trim()
    if (e.key === 'Enter' && live && onAdvance) onAdvance()
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
    onBlurViewportReset?.()
  }

  return (
    <input
      ref={ref}
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
      autoComplete={
        autoComplete ?? (type === 'tel' ? 'tel-national' : undefined)
      }
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onInput={(e) => onChange?.((e.target as HTMLInputElement).value)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
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
})

export default InputField
