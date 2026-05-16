'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import IntroWordCycle from './IntroWordCycle'
import { ROUTES } from '@/lib/routes'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import {
  INDUSTRIAL_OPACITY_SNAP,
  KINETIC_WORD_DWELL_MS,
  INTRO_ROUTE_SAFETY_TAIL_MS,
  INTRO_ROUTE_WORD_EXIT_MS,
  INTRO_SHIMMER_WORD_DWELL_MS,
  INTRO_SHIMMER_WORD_GAP_MS,
  SHIMMER_FOCUS,
} from '@/lib/animations'

type IntroScreenState = 'value-message' | 'decision'

/**
 * Mechanical sequence (SAVE MONEY CUT CARBON…):
 * v6 — dwell tuned for lens snap + stagger gap between words. (No leading HELLO — summary pulse owns that beat.)
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

const INTRO_KINETIC_WORDS_ARRAY = [...INTRO_KINETIC_WORDS]
const INTRO_WORD_SHIMMER_DURATIONS = INTRO_KINETIC_WORDS.map(() => INTRO_SHIMMER_WORD_DWELL_MS)

function introWordsMinDurationMs(
  wordCount: number,
  gapMs: number,
  dwellMs: number = KINETIC_WORD_DWELL_MS,
  exitMs: number = INTRO_ROUTE_WORD_EXIT_MS,
): number {
  const perWord = dwellMs + exitMs + gapMs
  return wordCount * perWord + INTRO_ROUTE_SAFETY_TAIL_MS
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
  const reduceMotion = useReducedMotion()
  const [screen, setScreen] = useState<IntroScreenState>('value-message')
  const urlHandledRef = useRef(false)

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
      INTRO_KINETIC_WORDS.length,
      INTRO_SHIMMER_WORD_GAP_MS,
      INTRO_SHIMMER_WORD_DWELL_MS,
    )
    const tid = window.setTimeout(() => {
      setScreen((s) => (s === 'value-message' ? 'decision' : s))
    }, safetyMs)
    return () => window.clearTimeout(tid)
  }, [screen])

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
          wordDurations={INTRO_WORD_SHIMMER_DURATIONS}
          lensFocusShimmer
          onComplete={() => setScreen((s) => (s === 'value-message' ? 'decision' : s))}
        />
      </div>
    )
  }

  const headlineInitial = reduceMotion
    ? { opacity: 0, y: 2 }
    : { ...SHIMMER_FOCUS.initial }
  const headlineAnimate = reduceMotion
    ? { opacity: 1, y: 0 }
    : { ...SHIMMER_FOCUS.animate }
  const headlineTransition = reduceMotion
    ? INDUSTRIAL_OPACITY_SNAP
    : SHIMMER_FOCUS.transition

  const ctaInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 2 }
  const ctaAnimate = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
  const ctaTransitionBase = INDUSTRIAL_OPACITY_SNAP

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
      <motion.h2
        className="intro-decision-headline zz-shimmer-focus"
        initial={headlineInitial}
        animate={headlineAnimate}
        transition={headlineTransition}
        style={{
          textAlign: 'center',
          margin: 0,
          marginBottom: 8,
          color: 'var(--color-yellow)',
        }}
      >
        CREATE A PROFILE TO START.
      </motion.h2>
      <div
        style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* v6.1: staggered bloom — `motion.a` keeps hit-testing on the same node as the transform (Link-in-wrapper could miss taps). */}
        <motion.a
          href={ROUTES.PROFILE}
          className="intro-cta-circle zz-h4 zz-shimmer-cta"
          initial={ctaInitial}
          animate={ctaAnimate}
          transition={{ ...ctaTransitionBase, delay: 0.28 }}
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
