'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WORD_PULSE_APPEAR, KINETIC_WORD_DWELL_MS } from '@/lib/animations'

interface IntroWordCycleProps {
  words: string[]
  onComplete?: () => void
  /** When true, don't add a period; use punctuation from the word (e.g. "less," or "more.") */
  preservePunctuation?: boolean
  /** When true, don't force uppercase (intro is locked to ALL-CAPS machine look by default) */
  preserveCase?: boolean
  /** When false, never append a full stop (mechanical intro / summary pulse). Default true. */
  trailingPeriod?: boolean
  /** Optional per-word dwell in ms. Falls back to KINETIC_WORD_DWELL_MS (400ms industrial pulse). */
  wordDurations?: number[]
  /** Gap between exit and next word (ms). Use `0` for a strict dwell-only heartbeat (e.g. 400ms intro/outro). */
  gapMs?: number
}

const DEFAULT_GAP_MS = 90
const WORD_EXIT_MS = 150

export default function IntroWordCycle({
  words,
  onComplete,
  preservePunctuation,
  preserveCase,
  trailingPeriod = true,
  wordDurations,
  gapMs = DEFAULT_GAP_MS,
}: IntroWordCycleProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const onCompleteRef = useRef(onComplete)
  const innerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef(false)
  onCompleteRef.current = onComplete

  const currentWord = words[index] ?? ''
  const displayText = (() => {
    const w = currentWord
    if (!trailingPeriod) return w
    if (preservePunctuation) {
      if (w.endsWith('.') || w.endsWith(',')) return w
      // Summary beats: money + carbon — no trailing full stop
      if (w.startsWith('£') || /kg$/i.test(w)) return w
    }
    return w + '.'
  })()

  const dwellMs = wordDurations?.[index] ?? KINETIC_WORD_DWELL_MS

  useEffect(() => {
    if (completedRef.current) return
    setVisible(true)
    const outerId = setTimeout(() => {
      setVisible(false)
      innerTimeoutRef.current = setTimeout(() => {
        innerTimeoutRef.current = null
        if (index < words.length - 1) {
          setIndex((i) => i + 1)
        } else if (!completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
      }, WORD_EXIT_MS + gapMs)
    }, dwellMs)
    return () => {
      clearTimeout(outerId)
      if (innerTimeoutRef.current) {
        clearTimeout(innerTimeoutRef.current)
        innerTimeoutRef.current = null
      }
    }
  }, [index, words.length, dwellMs, gapMs])

  // Last resort if word timers never finish (tab sleep, Strict Mode edge cases).
  // Must exceed real wall time: dwell + exit + gap per word.
  useEffect(() => {
    const maxDwell = Math.max(KINETIC_WORD_DWELL_MS, ...(wordDurations ?? []))
    const perWordMs = maxDwell + WORD_EXIT_MS + gapMs + 300
    const maxMs = words.length * perWordMs + 6000
    const safety = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current?.()
      }
    }, maxMs)
    return () => clearTimeout(safety)
  }, [words.length, wordDurations, gapMs])

  const variants = WORD_PULSE_APPEAR

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        minHeight: 120,
      }}
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.h1
            key={currentWord}
            className="intro-text-large intro-word-pulse"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            style={{
              margin: 0,
              padding: 0,
              width: '100%',
              maxWidth: 'min(96vw, 28ch)',
              textAlign: 'center',
              textTransform: preserveCase ? 'none' : 'uppercase',
              fontFamily: 'var(--font-marvin), var(--font-label), sans-serif',
            }}
          >
            {displayText}
          </motion.h1>
        )}
      </AnimatePresence>
    </div>
  )
}
