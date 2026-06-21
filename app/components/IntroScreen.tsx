'use client'

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import IntroWordCycle from './IntroWordCycle'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
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
  familyControlDelaySec,
  familyProfileStepProps,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import {
  INTRO_GOAL_QUESTION,
  PROFILE_GOAL_CHOICES,
  type ProfileGoalValue,
} from '@/lib/profile/goalWeighting'
import { syncSessionState } from '@/lib/sessionStateSync'

type IntroScreenState = 'logo' | 'value-message' | 'goal'

/**
 * Mechanical sequence (SAVE MONEY CUT CARBON…):
 * v6 — dwell tuned for lens snap + stagger gap between words. (No leading HELLO — summary pulse owns that beat.)
 * Post-kinetic → intent question (`would you like to?`) → `/profile`.
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
  zIndex: 120,
}

function getSkipFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const skip = params.get('skip') ?? params.get('step')
  return skip === '1' || skip === 'message'
}

function profileReadyInLocalStorage(): boolean {
  if (typeof window === 'undefined') return false
  const pc = (localStorage.getItem('profile_postcode') ?? '').replace(/\s+/g, '').trim()
  const name = (localStorage.getItem('profile_name') ?? '').trim()
  return pc.length >= 4 && name.length > 0
}

function introGoalAlreadySet(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(localStorage.getItem('profile_goal')?.trim())
}

export default function IntroScreen() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [screen, setScreen] = useState<IntroScreenState>('logo')
  const urlHandledRef = useRef(false)

  useEffect(() => {
    if (getSkipFromUrl()) return
    if (profileReadyInLocalStorage()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.ZONE })
      router.replace(ROUTES.ZONE)
    }
  }, [router])

  useEffect(() => {
    preloadAppFonts()
  }, [])

  useEffect(() => {
    router.prefetch(ROUTES.PROFILE)
  }, [router])

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
      if (introGoalAlreadySet()) {
        trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
        router.push(ROUTES.PROFILE)
        return
      }
      setScreen((s) => (s === 'value-message' ? 'goal' : s))
    }, safetyMs)
    return () => window.clearTimeout(tid)
  }, [screen, router])

  const handleGoalSelect = useCallback(
    (value: ProfileGoalValue) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile_goal', value)
        try {
          persistUnifiedUserProfileMemory()
        } catch {
          // ignore
        }
        syncSessionState()
      }
      trackFunnelEvent('intro_complete', { page: ROUTES.PROFILE })
      router.push(ROUTES.PROFILE)
    },
    [router]
  )

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
          onComplete={() => {
            if (introGoalAlreadySet()) {
              trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
              router.push(ROUTES.PROFILE)
              return
            }
            setScreen((s) => (s === 'value-message' ? 'goal' : s))
          }}
        />
      </div>
    )
  }

  const stepMotion = familyProfileStepProps(reduceMotion)
  const headlineMotion = familyAtomicProps(reduceMotion)

  return (
    <div
      className="intro-decision-screen"
      style={{
        ...fullScreenStyle,
        background: 'transparent',
        opacity: 1,
        visibility: 'visible',
        pointerEvents: 'auto',
      }}
    >
      <motion.div
        className="profile-step-slam w-full flex flex-col items-center"
        style={{ gap: 40, maxWidth: 520 }}
        initial={stepMotion.initial}
        animate={stepMotion.animate}
        transition={FAMILY_TRANSITION_ATOMIC}
      >
        <motion.h2
          className="text-marvin profile-question-headline intro-decision-headline zz-family-atomic"
          initial={headlineMotion.initial}
          animate={headlineMotion.animate}
          transition={FAMILY_TRANSITION_ATOMIC}
          style={{
            margin: 0,
            marginBottom: 0,
            color: 'var(--color-yellow)',
            maxWidth: 'min(92vw, 28rem)',
          }}
        >
          <span style={{ whiteSpace: 'pre-line', display: 'block' }}>{INTRO_GOAL_QUESTION}</span>
        </motion.h2>
        <div className="profile-step-controls profile-step-controls--options">
          {PROFILE_GOAL_CHOICES.map((choice, optionIndex) => (
            <ProfileAnswerBtn
              key={choice.value}
              reduceMotion={reduceMotion}
              optionIndex={optionIndex}
              delaySeconds={familyControlDelaySec(optionIndex)}
              className=""
              style={
                choice.theme
                  ? ({ '--local-theme': choice.theme } as CSSProperties & { '--local-theme'?: string })
                  : undefined
              }
              onClick={() => handleGoalSelect(choice.value)}
              aria-label={choice.ariaLabel}
            >
              <span className="profile-answer-btn__text zz-h4 intro-goal-btn__text">
                {choice.displayLabel}
              </span>
            </ProfileAnswerBtn>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
