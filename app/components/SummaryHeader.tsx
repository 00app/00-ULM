'use client'

/**
 * Profile summary — vertical staccato authority: one word per line, **opacity-only** snaps (no slide / no drift).
 * Sequence matches product copy: Hello → [Name] → Based … profile → people in … → waste → £… → and → 1t CO2 → per → year.
 */
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const STACCATO_DELAY_SEC = 0.1
const OPACITY_DURATION_SEC = 0.12

export type SummaryHeaderProps = {
  words: string[]
  onComplete?: () => void
}

export default function SummaryHeader({ words, onComplete }: SummaryHeaderProps) {
  const reduceMotion = useReducedMotion()
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    completedRef.current = false
    if (words.length === 0) {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current?.()
      }
      return
    }
    if (reduceMotion) {
      const id = requestAnimationFrame(() => {
        if (!completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
      })
      return () => cancelAnimationFrame(id)
    }
    const lastIndex = words.length - 1
    const settleMs = lastIndex * STACCATO_DELAY_SEC * 1000 + OPACITY_DURATION_SEC * 1000 + 60
    const t = window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current?.()
      }
    }, settleMs)
    return () => clearTimeout(t)
  }, [words, reduceMotion])

  if (words.length === 0) return null

  return (
    <header
      className="summary-staccato-header"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.12em',
        width: '100%',
        margin: 0,
        padding: 0,
      }}
      aria-live="polite"
    >
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          style={{
            display: 'block',
            fontFamily: 'var(--font-marvin), var(--font-label), sans-serif',
            fontSize: 'clamp(1rem, 4.5vw, 2.55rem)',
            lineHeight: 1.02,
            letterSpacing: '0.03em',
            textAlign: 'center',
            color: 'var(--color-yellow)',
            fontWeight: 700,
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  opacity: {
                    duration: OPACITY_DURATION_SEC,
                    delay: i * STACCATO_DELAY_SEC,
                    ease: 'linear',
                  },
                }
          }
        >
          {word}
        </motion.span>
      ))}
    </header>
  )
}
