'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import IntroWordCycle from './IntroWordCycle'
import { ROUTES } from '@/lib/routes'
import {
  DAMPED_SLAM_INITIAL,
  DAMPED_SLAM_ANIMATE,
  SLAM_SPRING,
  KINETIC_WORD_DWELL_MS,
} from '@/lib/animations'

type IntroScreenState = 'glitch' | 'value-message' | 'glitch-out' | 'decision'

// Match logo glitch animation duration (intro.css: glitch ~0.67s — 3× faster)
const GLITCH_DURATION_MS = 667
const LOGO_TO_TEXT_DELAY_MS = 180

/**
 * Mechanical sequence (400ms dwell per word; gap 0):
 * SAVE MONEY CUT CARBON FEEL GOOD USE LESS MORE
 */
const INTRO_KINETIC_WORDS = [
  'SAVE',
  'MONEY',
  'CUT',
  'CARBON',
  'FEEL',
  'GOOD',
  'USE',
  'LESS',
  'MORE',
] as const

const INTRO_WORD_DURATIONS = INTRO_KINETIC_WORDS.map(() => KINETIC_WORD_DWELL_MS)
/** Stable array identity for IntroWordCycle deps (avoid effect resets on parent re-render). */
const INTRO_KINETIC_WORDS_ARRAY = [...INTRO_KINETIC_WORDS]

const fullScreenStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  width: '100%',
  padding: 'clamp(20px, 3vw, 40px)',
  boxSizing: 'border-box',
  zIndex: 2,
}

/** Parse ?skip=1 or ?step=message from URL without useSearchParams (avoids Suspense block). */
function getSkipFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const skip = params.get('skip') ?? params.get('step')
  return skip === '1' || skip === 'message'
}

const ctaCircleStyle = {
  width: 100,
  height: 100,
  minWidth: 100,
  minHeight: 100,
  borderRadius: 9999,
  border: 'none' as const,
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box' as const,
  padding: '4px',
}

export default function IntroScreen() {
  const [screen, setScreen] = useState<IntroScreenState>(() => {
    if (typeof window === 'undefined') return 'glitch'
    try {
      const seen = sessionStorage.getItem('zz_intro_logo_seen')
      return seen === '1' ? 'value-message' : 'glitch'
    } catch {
      return 'glitch'
    }
  })
  const glitchAdvancedRef = useRef(false)
  const glitchAdvanceTimerRef = useRef<number | null>(null)

  const advanceFromGlitch = useCallback(() => {
    if (glitchAdvancedRef.current) return
    glitchAdvancedRef.current = true
    window.setTimeout(() => {
      setScreen((s) => (s === 'glitch' ? 'value-message' : s))
    }, LOGO_TO_TEXT_DELAY_MS)
  }, [])

  // URL skip: ?skip=1 or ?step=message → go straight to value-message
  useEffect(() => {
    try {
      sessionStorage.setItem('zz_intro_logo_seen', '1')
    } catch {
      // ignore
    }
    if (getSkipFromUrl()) {
      glitchAdvancedRef.current = true
      setScreen('value-message')
      return
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      glitchAdvancedRef.current = true
      setScreen('value-message')
    }
  }, [])

  // Single deterministic gate: always show logo briefly, then advance.
  useEffect(() => {
    if (screen !== 'glitch') return
    glitchAdvanceTimerRef.current = window.setTimeout(advanceFromGlitch, GLITCH_DURATION_MS + 350)
    return () => {
      if (glitchAdvanceTimerRef.current) {
        window.clearTimeout(glitchAdvanceTimerRef.current)
        glitchAdvanceTimerRef.current = null
      }
    }
  }, [screen, advanceFromGlitch])

  // Hard fail-safe: never let intro remain on glitch indefinitely.
  useEffect(() => {
    if (screen !== 'glitch') return
    const hardGuard = window.setTimeout(() => {
      setScreen((s) => (s === 'glitch' ? 'value-message' : s))
      glitchAdvancedRef.current = true
    }, 2500)
    return () => window.clearTimeout(hardGuard)
  }, [screen])

  // Guardrail: if kinetic callback is dropped, reveal logo handoff deterministically.
  useEffect(() => {
    if (screen !== 'value-message') return
    const expectedMs = INTRO_KINETIC_WORDS.length * (KINETIC_WORD_DWELL_MS + 150) + 200
    const tid = window.setTimeout(() => setScreen((s) => (s === 'value-message' ? 'glitch-out' : s)), expectedMs)
    return () => window.clearTimeout(tid)
  }, [screen])

  // Final MORE transitions directly into glitch logo, then decision.
  useEffect(() => {
    if (screen !== 'glitch-out') return
    const tid = window.setTimeout(() => setScreen((s) => (s === 'glitch-out' ? 'decision' : s)), GLITCH_DURATION_MS)
    return () => window.clearTimeout(tid)
  }, [screen])

  // First screen: animated logo; advances after 2s or on tap
  if (screen === 'glitch' || screen === 'glitch-out') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={screen === 'glitch' ? advanceFromGlitch : undefined}
        onPointerDown={screen === 'glitch' ? advanceFromGlitch : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (screen === 'glitch') advanceFromGlitch()
          }
        }}
        style={{
          ...fullScreenStyle,
          background: 'transparent',
          gap: 24,
          cursor: screen === 'glitch' ? 'pointer' : 'default',
        }}
        aria-label={screen === 'glitch' ? "Zero Zero logo — tap to continue" : "Zero Zero logo"}
      >
        <div className="zz-glitch-wrap">
          <div className="zz-glitch">
            {/* Visual lock: Yellow (base) + Pink (overlay) — animations in intro.css */}
            <img src="/assets/00%20brand%20mark%20yellow.svg" className="glitch-layer base" alt="" aria-hidden />
            <img src="/assets/00%20brand%20mark%20pink.svg" className="glitch-layer purple" alt="Zero Zero" />
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'value-message') {
    return (
      <motion.div
        initial={DAMPED_SLAM_INITIAL}
        animate={DAMPED_SLAM_ANIMATE}
        transition={SLAM_SPRING}
        style={{
          ...fullScreenStyle,
          background: 'transparent',
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto',
        }}
      >
        <IntroWordCycle
          words={INTRO_KINETIC_WORDS_ARRAY}
          preserveCase
          trailingPeriod={false}
          gapMs={0}
          wordDurations={INTRO_WORD_DURATIONS}
          onComplete={() => setScreen((s) => (s === 'value-message' ? 'glitch-out' : s))}
        />
      </motion.div>
    )
  }

  return (
    <div
      style={{
        ...fullScreenStyle,
        background: 'transparent',
        color: 'var(--color-yellow)',
        gap: 32,
        opacity: 1,
        visibility: 'visible',
        pointerEvents: 'auto',
      }}
    >
      <h2
        className="intro-decision-headline"
        style={{
          textAlign: 'center',
          margin: 0,
          marginBottom: 8,
          color: 'var(--color-yellow)',
        }}
      >
        CREATE A PROFILE TO START.
      </h2>
      <div
        style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <div>
          <Link
            href={ROUTES.PROFILE}
            prefetch={false}
            className="intro-cta-circle zz-h4"
            style={{
              ...ctaCircleStyle,
              background: 'var(--color-pink)',
              color: 'var(--color-yellow)',
            }}
            aria-label="Create profile"
          >
            CREATE
          </Link>
        </div>
        <div>
          <Link
            href={ROUTES.ZONE}
            prefetch={false}
            className="intro-cta-circle zz-h4"
            style={{
              ...ctaCircleStyle,
              background: 'transparent',
              color: 'var(--color-yellow)',
            }}
            aria-label="Skip to Zone"
          >
            SKIP
          </Link>
        </div>
      </div>
    </div>
  )
}
