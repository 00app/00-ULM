'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import EntryShell from '@/app/components/EntryShell'
import { GlitchLogo } from '@/app/components/Logo'
import { CookieEssentialNotice } from '@/app/components/CookieEssentialNotice'
import IntroWordCycle from '@/app/components/IntroWordCycle'
import { markOnboardingIntent } from '@/lib/profile/onboardingIntentCookie'
import { ROUTES } from '@/lib/routes'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { SecondaryCircleCta } from '@/app/components/ui/SecondaryCircleCta'
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

type IntroScreenState = 'logo' | 'logoOut' | 'kinetic' | 'splash'

/**
 * Entry order: logo glitches on, holds, glitches off -> kinetic word intro in sentence case
 * (Save money / Cut carbon / Feel good / Use less, more.) -> splash (headline + Get started /
 * Log in, both circles). Full entry order after this is
 * Splash -> Postcode -> First result -> Create account / Log in -> Zone.
 * The words only start once the logo has glitched off. Skip (circle, under the words, same
 * circle-cta language as Settings) jumps straight from the kinetic intro to the splash.
 */
const INTRO_KINETIC_WORDS = [
  'Save',
  'money',
  'Cut',
  'carbon',
  'Feel',
  'good',
  'Use',
  'less,',
  'more.',
] as const

/** How long the logo sits still between glitching on and glitching off. */
const INTRO_LOGO_HOLD_MS = 600

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
    router.prefetch(ROUTES.START)
  }, [router])

  // Safety: never leave the boot logo stuck if a glitch onComplete callback is missed.
  useEffect(() => {
    if (screen !== 'logo' && screen !== 'logoOut') return
    const t = window.setTimeout(() => setScreen('kinetic'), screen === 'logo' ? 2400 : 1200)
    return () => window.clearTimeout(t)
  }, [screen])

  const logoGlitchedOn = () => {
    window.setTimeout(() => setScreen((s) => (s === 'logo' ? 'logoOut' : s)), INTRO_LOGO_HOLD_MS)
  }

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
      {screen === 'logo' ? <GlitchLogo key="logo-on" width={100} onComplete={logoGlitchedOn} /> : null}
      {screen === 'logoOut' ? (
        <GlitchLogo
          key="logo-off"
          width={100}
          exit
          onComplete={() => setScreen((s) => (s === 'logoOut' ? 'kinetic' : s))}
        />
      ) : null}
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
          <SecondaryCircleCta ariaLabel="Skip intro" onClick={skipIntro} className="intro-skip-circle">
            SKIP
          </SecondaryCircleCta>
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
          <SecondaryCircleCta
            ariaLabel="Log in"
            onClick={() => {
              trackFunnelEvent('cta_click', { page: ROUTES.HOME, cta_label: 'log_in' })
              markOnboardingIntent()
              router.push(`${ROUTES.PROFILE}?entry=login`)
            }}
          >
            LOG
            <br />
            IN
          </SecondaryCircleCta>
        </>
      ) : null}
    </EntryShell>
  )
}
