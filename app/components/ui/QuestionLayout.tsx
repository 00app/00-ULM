'use client'

/**
 * Zero Zero Funky v1.4 — 3. Question Engine
 * Rules: 4px progress bar (no text), Roboto 900 headings, exact 40px margin to answer area.
 */

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SPRING_BLOOM } from '@/lib/animations'

/** Answer area starts exactly this many px below the question heading. */
export const QUESTION_TO_ANSWER_MARGIN_PX = 40

export interface ProgressBarProps {
  /** 0–1 */
  progress: number
  className?: string
}

/**
 * 4px progress bar — track vs fill must contrast (lock palette, not flat-on-flat).
 */
export function ProgressBar({ progress, className = '' }: ProgressBarProps) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div
      className={`w-full overflow-hidden rounded-[60px] ${className}`}
      style={{
        height: 4,
        background: 'color-mix(in srgb, var(--color-yellow) 35%, var(--color-purple))',
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          width: `${p * 100}%`,
          height: '100%',
          background: 'var(--color-yellow)',
          borderRadius: 60,
          transition: 'width 0.25s var(--easing-groovy)',
        }}
      />
    </div>
  )
}

export interface QuestionContainerProps {
  question: string
  children: React.ReactNode
  className?: string
  /** Optional icon (simple monochrome SVG only). No arrows. */
  icon?: React.ReactNode
}

/**
 * Zero Zero Funky v1.4 — Centered question layout. Answer area exactly 40px below question.
 */
export function QuestionContainer({
  question,
  children,
  className = '',
  icon,
}: QuestionContainerProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex items-center justify-center" style={{ color: 'var(--color-purple)' }}>
          {icon}
        </div>
      )}
      <h3
        className="w-full max-w-md text-marvin"
        style={{
          marginBottom: QUESTION_TO_ANSWER_MARGIN_PX,
          fontFamily: 'var(--font-marvin)',
          fontWeight: 700,
          fontSize: 'var(--zz-h3-mobile)',
          lineHeight: 'var(--zz-lh-heading)',
          letterSpacing: 'var(--zz-track-marvin)',
          color: 'var(--color-purple)',
          textTransform: 'lowercase',
        }}
      >
        {question}
      </h3>
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        {children}
      </div>
    </div>
  )
}

export interface AbsoluteSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

/**
 * Zero Zero Funky v1.4 — Percentage slider. Absolutely centered in container. Flat track (cool), flat thumb (blue).
 */
export function AbsoluteSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
}: AbsoluteSliderProps) {
  const [width, setWidth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth(w)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  const p = (value - min) / (max - min || 1)
  const thumbLeft = width > 0 ? p * (width - 24) : 0

  return (
    <div
      ref={ref}
      className={`relative flex items-center ${className}`}
      style={{
        width: '100%',
        maxWidth: 300,
        height: 40,
      }}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        style={{ margin: 0 }}
      />
      {/* Flat track */}
      <div
        className="absolute left-0 right-0 rounded-[9999px]"
        style={{
          height: 8,
          background: 'var(--color-purple)',
          boxShadow: 'none',
        }}
      />
      {/* Flat thumb — centered vertically, position by value */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: 24,
          height: 24,
          left: thumbLeft,
          background: 'var(--color-purple)',
          boxShadow: 'none',
        }}
        layout
        transition={SPRING_BLOOM}
      />
    </div>
  )
}
