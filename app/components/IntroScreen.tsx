'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import IntroWordCycle from './IntroWordCycle'
import { ROUTES } from '@/lib/routes'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import {
  INTRO_ROUTE_SAFETY_TAIL_MS,
  INTRO_ROUTE_WORD_EXIT_MS,
  INTRO_SHIMMER_WORD_GAP_MS,
  INTRO_TYPE_MOTION_SCALE,
} from '@/lib/animations'
import { AtomicLogo } from '@/app/components/Logo'
import {
  atomicWordHoldMs,
  familyAtomicProps,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import { preloadAppFonts } from '@/lib/architecturalPulse'

type IntroScreenState = 'logo' | 'value-message' | 'decision'

/**
 * Mechanical sequence (SAVE MONEY CUT CARBON…):
 * v6 — dwell tuned for lens snap + stagger gap between words. (No leading HELLO — summary pulse owns that beat.)
 * Post-summary → Zone hydration pulse words: `ARCHITECTURAL_PULSE_WORDS` in `lib/architecturalPulse.ts` (`isZoneReady` on `/zone`).
 */
const INTRO_KINETIC_WORDS = [
  'SAVE',
  'MONEY',
  'CUT',
  'CARBON',
  'FEEL',
  'GOOD',
  'use',
  'less,',
  'more.',
] as const

const INTRO_KINETIC_WORDS_ARRAY = [...INTRO_KINETIC_WORDS]
const INTRO_WORD_ATOMIC_DURATIONS = INTRO_KINETIC_WORDS.map((w) => atomicWordHoldMs(w))

/** Marvin lockup — sentence stack at 0.8 line-height (same rhythm as profile long prompts). */
const INTRO_DECISION_LOCKUP = 'CREATE A\nPROFILE TO\nSTART.'

function introWordsMinDurationMs(words: readonly string[], gapMs: number, exitMs: number): number {
  const total = words.reduce(
    (sum, w) => sum + Math.round(atomicWordHoldMs(w) * INTRO_TYPE_MOTION_SCALE) + exitMs + gapMs,
    0
  )
  return total + INTRO_ROUTE_SAFETY_TAIL_MS
}

const fullScreenStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100dvh',
  width: '100%',
  maxWidth: '100%',
  overflowX: 'hidden',
  padding: 'clamp(20px, 3vw, 40px)',
  boxSizing: 'border-box',
  /** Above `nextjs-portal` (z-index 100) so CREATE / SKIP receive clicks in dev + prod. */
  zIndex: 120,
}

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
  const reduceMotion = useHydrationSafeReducedMotion()
  const [screen, setScreen] = useState<IntroScreenState>('logo')
  const urlHandledRef = useRef(false)

  useEffect(() => {
    preloadAppFonts()
  }, [])

  useEffect(() => {
    if (urlHandledRef.current) return
    urlHandledRef.current = true
    if (getSkipFromUrl()) {
      setScreen('value-message')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('geolocation' in navigator)) return
    if (localStorage.getItem('profile_postcode')) return

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude),
          })
          const res = await fetch(`/api/geocode?${params.toString()}`)
          if (!res.ok) return
          const json = (await res.json()) as { postcode?: string }
          const postcode = typeof json.postcode === 'string' ? json.postcode.trim() : ''
          if (!postcode) return
          localStorage.setItem('profile_postcode', postcode.toUpperCase())
          try {
            persistUnifiedUserProfileMemory()
          } catch {
            //
          }
        } catch {
          // Non-fatal: users can still enter postcode manually.
        }
      },
      () => {
        // Silent fallback to manual postcode flow.
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    if (screen !== 'value-message') return
    const safetyMs = introWordsMinDurationMs(
      INTRO_KINETIC_WORDS,
      INTRO_SHIMMER_WORD_GAP_MS,
      INTRO_ROUTE_WORD_EXIT_MS
    )
    const tid = window.setTimeout(() => {
      setScreen((s) => (s === 'value-message' ? 'decision' : s))
    }, safetyMs)
    return () => window.clearTimeout(tid)
  }, [screen])

  if (screen === 'logo') {
    return (
      <div className="app-boot-glitch intro-boot-glitch" style={{ ...fullScreenStyle, pointerEvents: 'auto' }}>
        <AtomicLogo
          width={100}
          onComplete={() => setScreen((s) => (s === 'logo' ? 'value-message' : s))}
        />
      </div>
    )
  }

  if (screen === 'value-message') {
    return (
      <div
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
          gapMs={INTRO_SHIMMER_WORD_GAP_MS}
          wordExitMs={INTRO_ROUTE_WORD_EXIT_MS}
          wordDurations={INTRO_WORD_ATOMIC_DURATIONS}
          opacityTicker
          onComplete={() => setScreen((s) => (s === 'value-message' ? 'decision' : s))}
        />
      </div>
    )
  }

  const lockupMotion = familyAtomicProps(reduceMotion)
  const ctaMotion = familyAtomicProps(reduceMotion)

  return (
    <div
      className="intro-decision-screen"
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
      <motion.h2
        className="text-marvin profile-question-headline intro-decision-headline zz-family-atomic"
        initial={lockupMotion.initial}
        animate={lockupMotion.animate}
        transition={FAMILY_TRANSITION_ATOMIC}
        style={{
          margin: 0,
          marginBottom: 8,
          color: 'var(--color-yellow)',
          maxWidth: 'min(92vw, 28rem)',
        }}
      >
        <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{INTRO_DECISION_LOCKUP}</span>
      </motion.h2>
      <div
        style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* v6.1: staggered bloom — `motion.a` keeps hit-testing on the same node as the transform (Link-in-wrapper could miss taps). */}
        <motion.a
          href={ROUTES.PROFILE}
          className="intro-cta-circle zz-h4 zz-shimmer-cta"
          initial={ctaMotion.initial}
          animate={ctaMotion.animate}
          transition={{ ...FAMILY_TRANSITION_ATOMIC, delay: 0.28 }}
          style={{
            ...ctaCircleStyle,
            background: 'var(--color-pink)',
            color: 'var(--color-yellow)',
            textDecoration: 'none',
          }}
          aria-label="Create profile"
        >
          CREATE
        </motion.a>
      </div>
    </div>
  )
}
