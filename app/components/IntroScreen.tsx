'use client'

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import IntroWordCycle from './IntroWordCycle'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { markOnboardingIntent } from '@/lib/profile/onboardingIntentCookie'
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
import { CookieEssentialNotice } from '@/app/components/CookieEssentialNotice'
import {
  hasPartialStoredProfile,
  isStoredProfileOnboardingComplete,
  readStoredProfileGoal,
} from '@/lib/profile/onboardingComplete'

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

function introGoalAlreadySet(): boolean {
  return Boolean(readStoredProfileGoal())
}

export default function IntroScreen() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [screen, setScreen] = useState<IntroScreenState>('logo')
  const urlHandledRef = useRef(false)

  useEffect(() => {
    if (getSkipFromUrl()) return
    if (typeof window !== 'undefined') {
      const step = new URLSearchParams(window.location.search).get('step')
      if (step === 'goal') return
    }
    if (isStoredProfileOnboardingComplete()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.ZONE })
      router.replace(ROUTES.ZONE)
      return
    }
    if (readStoredProfileGoal() && hasPartialStoredProfile()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
      router.replace(ROUTES.PROFILE)
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
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const step = params.get('step')
    if (getSkipFromUrl()) {
      setScreen('value-message')
      return
    }
    if (step === 'goal') {
      // Goal is now asked inline in /profile (step two, right after the guest/create fork),
      // not on this page — any old ?step=goal link just bounces straight through.
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
      router.replace(ROUTES.PROFILE)
    }
  }, [router])

  useEffect(() => {
    if (screen !== 'goal') return
    if (!introGoalAlreadySet()) return
    trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
    router.replace(ROUTES.PROFILE)
  }, [screen, router])

  useEffect(() => {
    if (screen !== 'value-message') return
    const safetyMs = introWordsMinDurationMs(
      INTRO_KINETIC_WORDS,
      INTRO_SHIMMER_WORD_GAP_MS,
      INTRO_ROUTE_WORD_EXIT_MS
    )
    const tid = window.setTimeout(() => {
      // Goal is asked inline in /profile now, not here — always hand off once the
      // value-message animation finishes, regardless of whether goal is already set.
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
      markOnboardingIntent()
      router.push(ROUTES.PROFILE)
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
      markOnboardingIntent()
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
            // Goal is asked inline in /profile now, not here.
            trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
            markOnboardingIntent()
      router.push(ROUTES.PROFILE)
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
        <CookieEssentialNotice />
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
