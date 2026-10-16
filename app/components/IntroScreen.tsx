'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import EntryShell from '@/app/components/EntryShell'
import { AtomicLogo } from '@/app/components/Logo'
import { CookieEssentialNotice } from '@/app/components/CookieEssentialNotice'
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { markOnboardingIntent } from '@/lib/profile/onboardingIntentCookie'
import { ROUTES } from '@/lib/routes'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { atomicWordHoldMs, familyControlDelaySec } from '@/lib/motion-family'
import {
  INTRO_ROUTE_SAFETY_TAIL_MS,
  INTRO_ROUTE_WORD_EXIT_MS,
  INTRO_SHIMMER_WORD_GAP_MS,
  INTRO_TYPE_MOTION_SCALE,
} from '@/lib/animations'
import {
  hasPartialStoredProfile,
  isStoredProfileOnboardingComplete,
  readStoredProfileGoal,
} from '@/lib/profile/onboardingComplete'

type IntroScreenState = 'logo' | 'kinetic' | 'splash'

/**
 * Entry order: boot logo -> kinetic word intro (SAVE MONEY CUT CARBON FEEL GOOD USE LESS MORE)
 * -> splash (logo stays, headline + Get started / Log in). Full entry order after this is
 * Splash -> Postcode -> First result -> Create account / Log in -> Zone.
 * Skip (circle, top-right, same circle-cta language as Settings) jumps straight from the
 * kinetic intro to the splash.
 */
const INTRO_KINETIC_WORDS = [
  'SAVE',
  'MONEY',
  'CUT',
  'CARBON',
  'FEEL',
  'GOOD',
  'USE',
  'LESS,',
  'MORE.',
] as const

const INTRO_KINETIC_WORDS_ARRAY = [...INTRO_KINETIC_WORDS]

function introWordsMinDurationMs(words: readonly string[], gapMs: number, exitMs: number): number {
  const total = words.reduce(
    (sum, w) => sum + Math.round(atomicWordHoldMs(w) * INTRO_TYPE_MOTION_SCALE) + exitMs + gapMs,
    0
  )
  return total + INTRO_ROUTE_SAFETY_TAIL_MS
}

export default function IntroScreen() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [screen, setScreen] = useState<IntroScreenState>('logo')

  // Returning users with a finished profile skip the whole intro + splash.
  useEffect(() => {
    if (isStoredProfileOnboardingComplete()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.ZONE })
      router.replace(ROUTES.ZAI)
      return
    }
    if (readStoredProfileGoal() && hasPartialStoredProfile()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
      router.replace(ROUTES.PROFILE)
    }
  }, [router])

  useEffect(() => {
    preloadAppFonts()
    router.prefetch(ROUTES.START)
  }, [router])

  // Safety: never leave the boot logo stuck if its onComplete callback is missed.
  useEffect(() => {
    if (screen !== 'logo') return
    const t = window.setTimeout(() => setScreen('kinetic'), 1800)
    return () => window.clearTimeout(t)
  }, [screen])

  // Safety: never get stuck on the kinetic words if IntroWordCycle's onComplete is missed.
  useEffect(() => {
    if (screen !== 'kinetic') return
    const safetyMs = introWordsMinDurationMs(
      INTRO_KINETIC_WORDS,
      INTRO_SHIMMER_WORD_GAP_MS,
      INTRO_ROUTE_WORD_EXIT_MS
    )
    const t = window.setTimeout(() => setScreen('splash'), safetyMs)
    return () => window.clearTimeout(t)
  }, [screen])

  const skipIntro = () => {
    trackFunnelEvent('cta_click', { page: ROUTES.HOME, cta_label: 'skip_intro' })
    setScreen('splash')
  }

  return (
    <EntryShell>
      <CookieEssentialNotice />
      <AtomicLogo width={100} onComplete={() => setScreen((s) => (s === 'logo' ? 'kinetic' : s))} />
      {screen === 'kinetic' ? (
        <>
          <div style={{ position: 'relative', width: '100%', minHeight: 120 }}>
            <IntroWordCycle
              words={INTRO_KINETIC_WORDS_ARRAY}
              preserveCase
              literalCase
              condensedFont
              trailingPeriod={false}
              gapMs={INTRO_SHIMMER_WORD_GAP_MS}
              wordExitMs={INTRO_ROUTE_WORD_EXIT_MS}
              onComplete={() => setScreen('splash')}
            />
          </div>
          <button
            type="button"
            onClick={skipIntro}
            className="settings-circle-cta settings-circle-cta--secondary intro-skip-circle"
            aria-label="Skip intro"
          >
            <span className="settings-circle-cta__label zz-h4">SKIP</span>
          </button>
        </>
      ) : null}
      {screen === 'splash' ? (
        <>
          <h1
            className="zz-h2 text-display m-0 text-center"
            style={{ maxWidth: 'min(92vw, 48rem)', color: 'var(--color-blue)' }}
          >
            Save, use less, more.
          </h1>
          <div className="profile-step-controls profile-step-controls--options">
            <ProfileAnswerBtn
              reduceMotion={reduceMotion}
              optionIndex={0}
              delaySeconds={familyControlDelaySec(0)}
              className=""
              onClick={() => {
                trackFunnelEvent('cta_click', { page: ROUTES.HOME, cta_label: 'get_started' })
                router.push(ROUTES.START)
              }}
              aria-label="Get started"
            >
              <span className="profile-answer-btn__text zz-h4">
                GET
                <br />
                STARTED
              </span>
            </ProfileAnswerBtn>
          </div>
          <button
            type="button"
            className="entry-text-link"
            onClick={() => {
              trackFunnelEvent('cta_click', { page: ROUTES.HOME, cta_label: 'log_in' })
              markOnboardingIntent()
              router.push(`${ROUTES.PROFILE}?entry=login`)
            }}
          >
            Log in
          </button>
        </>
      ) : null}
    </EntryShell>
  )
}
