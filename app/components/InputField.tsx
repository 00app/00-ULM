'use client'

import React, { KeyboardEvent } from 'react'

interface InputFieldProps {
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onAdvance?: () => void
  type?: 'text' | 'number' | 'email' | 'password'
  width?: string | number
  className?: string
}

export default function InputField({
  value = '',
  placeholder,
  onChange,
  onAdvance,
  type = 'text',
  width,
  className,
}: InputFieldProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value?.trim() && onAdvance) onAdvance()
  }

  return (
    <input
      type={type === 'number' ? 'text' : type === 'email' ? 'email' : type === 'password' ? 'password' : 'text'}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      style={{
        width: width ?? '100%',
        maxWidth: 360,
        padding: '14px 20px',
        borderRadius: 40,
        border: 'none',
        background: 'var(--color-cool)',
        fontFamily: 'Roboto',
        fontSize: 16,
        fontWeight: 400,
        color: 'var(--color-deep)',
      }}
    />
  )
}
