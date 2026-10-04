'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import EntryShell from '@/app/components/EntryShell'
import { AtomicLogo } from '@/app/components/Logo'
import { CookieEssentialNotice } from '@/app/components/CookieEssentialNotice'
import { markOnboardingIntent } from '@/lib/profile/onboardingIntentCookie'
import { ROUTES } from '@/lib/routes'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { familyControlDelaySec } from '@/lib/motion-family'
import {
  hasPartialStoredProfile,
  isStoredProfileOnboardingComplete,
  readStoredProfileGoal,
} from '@/lib/profile/onboardingComplete'

/**
 * Splash (`/` and `/intro`): logo, one line, Get started, Log in.
 * Entry order is Splash → Postcode → First result → Create account / Log in → Zone.
 * The kinetic word sequence and the three-option goal screen that used to live here are gone;
 * the goal question is asked inside /profile after account creation.
 */
export default function IntroScreen() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [logoDone, setLogoDone] = useState(false)

  // Returning users with a finished profile skip the splash entirely.
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

  // Safety: never leave the splash without its actions if the logo animation callback is missed.
  useEffect(() => {
    const t = window.setTimeout(() => setLogoDone(true), 1800)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <EntryShell>
      <CookieEssentialNotice />
      <AtomicLogo width={100} onComplete={() => setLogoDone(true)} />
      {logoDone ? (
        <>
          <h1
            className="zz-h2 text-display m-0 text-center"
            style={{ maxWidth: 'min(92vw, 48rem)', color: 'var(--color-blue)' }}
          >
            Pay less for your home.
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
