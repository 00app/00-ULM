'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import {
  INDUSTRIAL_OPACITY_SNAP,
  WORD_PULSE_APPEAR,
  KINETIC_WORD_DWELL_MS,
  SHIMMER_FOCUS,
  SHIMMER_FOCUS_EXIT,
  STACCATO_DURATION_SEC,
  STACCATO_EASE,
} from '@/lib/animations'

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
  /**
   * v6 — Fussy blur → sharp lens focus per word (pairs with `.zz-shimmer-focus` + SHIMMER_FOCUS_*).
   * Default off so summary / other cycles keep WORD_PULSE_APPEAR.
   */
  lensFocusShimmer?: boolean
  /** Optional viewport padding budget for auto-fit (e.g. 40 => 40px left + right). */
  fitToViewportPaddingPx?: number
  /**
   * Summary / locality: allow wrapping + balanced lines for long tokens (>7 chars) instead of nowrap shrink-only.
   */
  wrapLongPreservedWords?: boolean
  /** Exit blur duration before next word; intro uses `INTRO_ROUTE_WORD_EXIT_MS` (~30% faster than default). */
  wordExitMs?: number
  /**
   * `/profile/summary` + Mechanical Snap DNA: one word at a time, **opacity only**.
   * Intro `/` + `/intro` keep **`WORD_PULSE_APPEAR`** (Style A glitch) unless this is set.
   */
  opacityTicker?: boolean
  /** Extra glow on £ tokens when Neon genome savings drive the kinetic headline. */
  pulseGenomeMoney?: boolean
  /** On the final word: fire `onComplete` after dwell but keep the word visible (hydration shield). */
  holdFinalWord?: boolean
}

const DEFAULT_GAP_MS = 90
const DEFAULT_WORD_EXIT_MS = 150

export default function IntroWordCycle({
  words,
  onComplete,
  preservePunctuation,
  preserveCase,
  trailingPeriod = true,
  wordDurations,
  gapMs = DEFAULT_GAP_MS,
  lensFocusShimmer = false,
  fitToViewportPaddingPx = 0,
  wrapLongPreservedWords = false,
  wordExitMs = DEFAULT_WORD_EXIT_MS,
  opacityTicker = false,
  pulseGenomeMoney = false,
  holdFinalWord = false,
}: IntroWordCycleProps) {
  const reduceMotion = useHydrationSafeReducedMotion()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [fitScale, setFitScale] = useState(1)
  const onCompleteRef = useRef(onComplete)
  const innerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef(false)
  const wordRef = useRef<HTMLHeadingElement | null>(null)
  onCompleteRef.current = onComplete

  const currentWord = words[index] ?? ''
  const displayText = (() => {
    const w = currentWord
    if (!trailingPeriod) return w
    if (preservePunctuation) {
      if (w.endsWith('.') || w.endsWith(',')) return w
      // Summary beats: money + carbon — no trailing full stop
      if (w.startsWith('£') || /kg$/i.test(w) || /\bco₂e\b/i.test(w) || /\bco2e\b/i.test(w)) return w
    }
    return w + '.'
  })()

  const dwellMs = wordDurations?.[index] ?? KINETIC_WORD_DWELL_MS

  const motionPreset = useMemo(() => {
    if (opacityTicker) {
      const t = { duration: STACCATO_DURATION_SEC, ease: STACCATO_EASE }
      return {
        className: 'intro-text-large intro-summary-opacity-ticker',
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: t },
        exit: { opacity: 0, transition: { ...t, duration: STACCATO_DURATION_SEC * 0.85 } },
      }
    }
    if (!lensFocusShimmer) {
      return {
        className: 'intro-text-large intro-word-pulse',
        initial: WORD_PULSE_APPEAR.initial,
        animate: WORD_PULSE_APPEAR.animate,
        exit: WORD_PULSE_APPEAR.exit,
      }
    }
    if (reduceMotion) {
      return {
        className: 'intro-text-large intro-word-pulse zz-shimmer-focus',
        initial: { opacity: 0, y: 2 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 2, transition: INDUSTRIAL_OPACITY_SNAP },
        transition: INDUSTRIAL_OPACITY_SNAP,
      }
    }
    return {
      className: 'intro-text-large intro-word-pulse zz-shimmer-focus',
      initial: { ...SHIMMER_FOCUS.initial },
      animate: { ...SHIMMER_FOCUS.animate },
      exit: {
        ...SHIMMER_FOCUS_EXIT,
        transition: INDUSTRIAL_OPACITY_SNAP,
      },
      transition: SHIMMER_FOCUS.transition,
    }
  }, [opacityTicker, lensFocusShimmer, reduceMotion])

  useEffect(() => {
    if (completedRef.current) return
    setVisible(true)
    const outerId = setTimeout(() => {
      if (index < words.length - 1) {
        setVisible(false)
        innerTimeoutRef.current = setTimeout(() => {
          innerTimeoutRef.current = null
          setIndex((i) => i + 1)
        }, wordExitMs + gapMs)
      } else {
        if (!completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
        if (!holdFinalWord) setVisible(false)
      }
    }, dwellMs)
    return () => {
      clearTimeout(outerId)
      if (innerTimeoutRef.current) {
        clearTimeout(innerTimeoutRef.current)
        innerTimeoutRef.current = null
      }
    }
  }, [index, words.length, dwellMs, gapMs, wordExitMs, holdFinalWord])

  // Last resort if word timers never finish (tab sleep, Strict Mode edge cases).
  // Must exceed real wall time: dwell + exit+gap per word.
  useEffect(() => {
    const maxDwell = Math.max(KINETIC_WORD_DWELL_MS, ...(wordDurations ?? []))
    const perWordMs = maxDwell + wordExitMs + gapMs + 300
    const maxMs = words.length * perWordMs + 6000
    const safety = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onCompleteRef.current?.()
      }
    }, maxMs)
    return () => clearTimeout(safety)
  }, [words.length, wordDurations, gapMs, wordExitMs])

  const isMultiline = displayText.includes('\n')

  const useBalancedWrap =
    wrapLongPreservedWords &&
    preserveCase &&
    !isMultiline &&
    displayText.replace(/\s/g, '').length > 7

  /** Summary locality: long letter-only token (e.g. Littlehampton) — tighter Marvin clamp + extra fit squeeze.
   *  Kept independent of Zone bento stagger — `fitToViewportPaddingPx` on `/profile/summary` drives squeeze. */
  const looksLikeLongPlaceToken =
    wrapLongPreservedWords &&
    preserveCase &&
    !isMultiline &&
    !displayText.startsWith('£') &&
    !/\d/.test(displayText) &&
    displayText.replace(/[\s'-]/g, '').length > 7

  useEffect(() => {
    if (fitToViewportPaddingPx <= 0) {
      setFitScale(1)
      return
    }
    if (typeof window === 'undefined') return
    const updateScale = () => {
      const el = wordRef.current
      if (!el) return
      const available = Math.max(120, window.innerWidth - fitToViewportPaddingPx * 2)
      const lineEls = el.querySelectorAll<HTMLElement>('[data-fit-line]')
      const needed =
        lineEls.length > 0
          ? Math.max(1, ...Array.from(lineEls).map((n) => Math.ceil(n.scrollWidth)))
          : Math.ceil(el.scrollWidth)
      if (needed <= 0) {
        setFitScale(1)
        return
      }
      let next = Math.min(1, available / needed)
      /** Single long token (>7 chars): extra squeeze so Marvin never kisses the viewport edge */
      if (!isMultiline && displayText.replace(/\s/g, '').length > 7) {
        next *= looksLikeLongPlaceToken ? 0.86 : 0.94
      }
      /** Two-line locality: keep both lines inside the 40px + 40px gutter */
      if (isMultiline && wrapLongPreservedWords) {
        next *= 0.92
      }
      setFitScale(next)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [currentWord, displayText, fitToViewportPaddingPx, isMultiline, useBalancedWrap, looksLikeLongPlaceToken, wrapLongPreservedWords])

  const tickerGenomeGlow =
    pulseGenomeMoney && opacityTicker && displayText.startsWith('£') ? ' intro-summary-genome-money-pulse' : ''

  return (
    <div
      className={lensFocusShimmer ? 'zz-shimmer-focus' : undefined}
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
      <>
        {visible && (
          <motion.h1
            ref={wordRef}
            key={currentWord}
            className={`${motionPreset.className}${tickerGenomeGlow}`}
            initial={motionPreset.initial}
            animate={motionPreset.animate}
            exit={motionPreset.exit}
            {...('transition' in motionPreset && motionPreset.transition
              ? { transition: motionPreset.transition }
              : {})}
            style={{
              margin: 0,
              padding: 0,
              width: 'auto',
              maxWidth: fitToViewportPaddingPx > 0 ? `calc(100vw - ${fitToViewportPaddingPx * 2}px)` : 'min(96vw, 28ch)',
              textAlign: 'center',
              whiteSpace: isMultiline ? 'pre-line' : useBalancedWrap ? 'normal' : 'nowrap',
              textWrap: useBalancedWrap ? ('balance' as React.CSSProperties['textWrap']) : undefined,
              overflowWrap: useBalancedWrap || wrapLongPreservedWords ? ('anywhere' as const) : undefined,
              wordBreak: useBalancedWrap ? ('break-word' as const) : undefined,
              textTransform: preserveCase ? 'none' : 'uppercase',
              fontFamily: 'var(--font-marvin), var(--font-label), sans-serif',
              ...(useBalancedWrap
                ? {
                    fontSize: 'clamp(0.92rem, min(7vw, 8.5vmin), 2.45rem)',
                  }
                : looksLikeLongPlaceToken
                  ? {
                      fontSize: 'clamp(0.58rem, min(3.6vw + 0.9vmin, 4.8vmin), 1.75rem)',
                    }
                  : {}),
              transform: `scale(${fitScale})`,
              transformOrigin: 'center center',
            }}
          >
            {isMultiline
              ? displayText.split('\n').map((line, i) => (
                  <span
                    key={`${i}-${line}`}
                    data-fit-line
                    style={{
                      display: 'block',
                      whiteSpace: wrapLongPreservedWords ? 'normal' : 'nowrap',
                      maxWidth: '100%',
                      overflowWrap: wrapLongPreservedWords ? ('anywhere' as const) : undefined,
                    }}
                  >
                    {line}
                  </span>
                ))
              : displayText}
          </motion.h1>
        )}
      </>
    </div>
  )
}
