'use client'

/**
 * Zero Zero Funky v1.4 — 2. Form Elements (Inputs & Toggles)
 * Rules: zero shadows, no focus rings, no inner shadows. Pure 9999px radius, flat colors.
 */

import { useId } from 'react'
import { motion } from 'framer-motion'

import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

export interface FlatTextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Optional label (visually only; use aria-label for a11y) */
  label?: string
  type?: 'text' | 'email' | 'search'
}

/**
 * Zero Zero Funky v1.4 — Pill text input. 9999px radius. Flat cool background. No focus shadow.
 */
export function FlatTextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  label,
  type = 'text',
}: FlatTextInputProps) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 font-[var(--font-label)] text-xs uppercase tracking-wide text-[var(--color-purple)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-[9999px] border-0 py-3 px-5 outline-none focus:ring-0"
        style={{
          background: 'var(--color-purple)',
          color: 'var(--color-purple)',
          boxShadow: 'none',
          fontFamily: 'var(--font-roboto), sans-serif',
          fontSize: 'var(--zz-body-size)',
          fontWeight: 800,
        }}
        aria-label={label}
      />
    </div>
  )
}

export interface FlatNumberInputProps {
  value: number | ''
  onChange: (value: number | '') => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  label?: string
}

/**
 * Zero Zero Funky v1.4 — Pill number input. Same as FlatTextInput; no focus shadow.
 */
export function FlatNumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 1,
  disabled = false,
  className = '',
  label,
}: FlatNumberInputProps) {
  const id = useId()
  const str = value === '' ? '' : String(value)
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 font-[var(--font-label)] text-xs uppercase tracking-wide text-[var(--color-purple)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type="number"
        value={str}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') {
            onChange('')
            return
          }
          const n = Number(v)
          if (!Number.isNaN(n)) onChange(n)
        }}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full rounded-[9999px] border-0 py-3 px-5 outline-none focus:ring-0"
        style={{
          background: 'var(--color-purple)',
          color: 'var(--color-purple)',
          boxShadow: 'none',
          fontFamily: 'var(--font-roboto), sans-serif',
          fontSize: 'var(--zz-body-size)',
          fontWeight: 800,
        }}
        aria-label={label}
      />
    </div>
  )
}

// --- FlatToggle (Settings) ---

export interface FlatToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  journeyColor?: string
  className?: string
  label?: string
}

/**
 * Zero Zero Funky v1.4 — Toggle. Cool track, journey-color thumb when active. No shadows.
 */
export function FlatToggle({
  checked,
  onChange,
  disabled = false,
  journeyColor = 'var(--color-purple)',
  className = '',
  label,
}: FlatToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <motion.span
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
        className="relative inline-block rounded-[9999px]"
        style={{
          width: 48,
          height: 28,
          background: 'var(--color-purple)',
          boxShadow: 'none',
        }}
      >
        <motion.span
          className="absolute top-1 rounded-full"
          style={{
            width: 22,
            height: 22,
            left: 3,
            top: 3,
            background: checked ? journeyColor : 'var(--color-purple)',
            boxShadow: 'none',
          }}
          animate={{ left: checked ? 23 : 3 }}
          transition={INDUSTRIAL_OPACITY_SNAP}
        />
      </motion.span>
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-roboto), sans-serif',
            fontSize: 'var(--zz-body-size)',
            fontWeight: 800,
            lineHeight: 'var(--zz-lh-body)',
            color: 'var(--color-purple)',
          }}
        >
          {label}
        </span>
      )}
    </label>
  )
}
