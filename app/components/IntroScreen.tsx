'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import IntroWordCycle from './IntroWordCycle'
import { ROUTES } from '@/lib/routes'
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import {
  KINETIC_WORD_DWELL_MS,
  INTRO_DECISION_CTA_TRANSITION,
  INTRO_SHIMMER_WORD_DWELL_MS,
  INTRO_SHIMMER_WORD_GAP_MS,
  SHIMMER_FOCUS,
} from '@/lib/animations'

type IntroScreenState = 'glitch' | 'value-message' | 'decision'

/** Must match `.zz-glitch` / layer keyframe duration in `app/globals.css` */
const GLITCH_ANIM_MS = 670
/** Extra time on the final (settled) frame after layers finish — intro words never start mid-glitch */
const GLITCH_SETTLE_HOLD_MS = 420
/** Reduced motion: static logo beat before words (CSS animations off via globals) */
const GLITCH_REDUCE_MOTION_HOLD_MS = 380

const WORD_EXIT_MS = 150

/**
 * Mechanical sequence (SAVE MONEY CUT CARBON…):
 * v6 — dwell tuned for lens snap + stagger gap between words.
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
): number {
  const perWord = dwellMs + WORD_EXIT_MS + gapMs
  return wordCount * perWord + 800
}

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
  const [screen, setScreen] = useState<IntroScreenState>('glitch')
  const urlHandledRef = useRef(false)

  useEffect(() => {
    if (urlHandledRef.current) return
    urlHandledRef.current = true
    if (getSkipFromUrl()) {
      setScreen('value-message')
    }
  }, [])

  useEffect(() => {
    if (screen !== 'glitch') return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const glitchMs = reduce ? GLITCH_REDUCE_MOTION_HOLD_MS : GLITCH_ANIM_MS + GLITCH_SETTLE_HOLD_MS
    const id = window.setTimeout(() => {
      setScreen((s) => (s === 'glitch' ? 'value-message' : s))
    }, glitchMs)
    return () => window.clearTimeout(id)
  }, [screen])

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

  if (screen === 'glitch') {
    return (
      <div
        style={{
          ...fullScreenStyle,
          background: 'transparent',
          gap: 24,
        }}
        aria-label="Zero Zero animated logo"
      >
        <div className="zz-glitch-wrap">
          <div className="zz-glitch">
            <img src="/assets/00%20brand%20mark%20yellow.svg" className="glitch-layer base" alt="" aria-hidden />
            <img src="/assets/00%20brand%20mark%20pink.svg" className="glitch-layer purple" alt="Zero Zero" />
          </div>
        </div>
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
          wordDurations={INTRO_WORD_SHIMMER_DURATIONS}
          lensFocusShimmer
          onComplete={() => setScreen((s) => (s === 'value-message' ? 'decision' : s))}
        />
      </div>
    )
  }

  const headlineInitial = reduceMotion
    ? { opacity: 0, scale: 0.995 }
    : { ...SHIMMER_FOCUS.initial }
  const headlineAnimate = reduceMotion
    ? { opacity: 1, scale: 1, filter: 'none' }
    : { ...SHIMMER_FOCUS.animate }
  const headlineTransition = reduceMotion
    ? { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const }
    : SHIMMER_FOCUS.transition

  /** ELASTIC_PING family + v6 520/28 tension; scale 0 → 1 (no layout/copy change). */
  const ctaInitial = reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 1 }
  const ctaAnimate = reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
  const ctaTransitionBase = reduceMotion
    ? { type: 'tween' as const, duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
    : INTRO_DECISION_CTA_TRANSITION

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
        {/* v6.1: staggered bloom — 400ms / 600ms; same 520/28 spring as profile answers (INTRO_DECISION_CTA_TRANSITION) */}
        <motion.div
          className="zz-shimmer-cta"
          initial={ctaInitial}
          animate={ctaAnimate}
          transition={{ ...ctaTransitionBase, delay: 0.4 }}
          style={{ display: 'flex' }}
        >
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
        </motion.div>
        <motion.div
          className="zz-shimmer-cta"
          initial={ctaInitial}
          animate={ctaAnimate}
          transition={{ ...ctaTransitionBase, delay: 0.6 }}
          style={{ display: 'flex' }}
        >
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
        </motion.div>
      </div>
    </div>
  )
}
