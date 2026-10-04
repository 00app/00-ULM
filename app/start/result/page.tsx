'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EntryShell from '@/app/components/EntryShell'
import ProfileAnswerBtn from '@/app/components/ui/ProfileAnswerBtn'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyControlDelaySec } from '@/lib/motion-family'
import { isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { PROFILE_STORAGE_KEYS } from '@/lib/profile/onboardingComplete'
import { markOnboardingIntent } from '@/lib/profile/onboardingIntentCookie'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'
import type { FirstResult } from '@/lib/entry/firstResult'

type Phase = 'loading' | 'ready' | 'not_found'

/**
 * Entry step 3: ONE real figure for this postcode, then the ask.
 * Mechanical truth: if no verified source returns a value, the figure block is omitted and the
 * action is still shown. Nothing here estimates or defaults a number.
 */
function StartResult() {
  const router = useRouter()
  const params = useSearchParams()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<FirstResult | null>(null)
  const [postcode, setPostcode] = useState('')

  useEffect(() => {
    let pc = params.get('postcode')?.trim() ?? ''
    if (!pc) {
      try {
        pc = localStorage.getItem(PROFILE_STORAGE_KEYS.postcode)?.trim() ?? ''
      } catch {
        /* storage blocked */
      }
    }
    if (!isValidUkPostcode(pc)) {
      router.replace(ROUTES.START)
      return
    }
    setPostcode(pc)
    const ctrl = new AbortController()
    void fetch(`/api/first-result?postcode=${encodeURIComponent(pc)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setPhase('not_found')
          return
        }
        const json = res.ok ? ((await res.json()) as { result: FirstResult | null }) : { result: null }
        setResult(json.result ?? null)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === 'AbortError') return
        setResult(null)
        setPhase('ready')
      })
    return () => ctrl.abort()
  }, [params, router])

  const goCreate = () => {
    trackFunnelEvent('cta_click', { page: ROUTES.START_RESULT, cta_label: 'create_account' })
    markOnboardingIntent()
    router.push(`${ROUTES.PROFILE}?entry=create`)
  }
  const goLogin = () => {
    trackFunnelEvent('cta_click', { page: ROUTES.START_RESULT, cta_label: 'log_in' })
    markOnboardingIntent()
    router.push(`${ROUTES.PROFILE}?entry=login`)
  }
  const goGuest = () => {
    trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.ZONE })
    router.push(ROUTES.ZONE)
  }

  if (phase === 'not_found') {
    return (
      <EntryShell>
        <h1 className="zz-h2 text-display m-0 text-center" style={{ color: 'var(--color-blue)' }}>
          We can&apos;t find that postcode.
        </h1>
        <button type="button" className="entry-text-link" onClick={() => router.replace(ROUTES.START)}>
          Try another
        </button>
      </EntryShell>
    )
  }

  return (
    <EntryShell>
      {phase === 'loading' ? (
        <p className="zz-body m-0" aria-live="polite">
          Checking {postcode}…
        </p>
      ) : (
        <>
          {result ? (
            <div className="flex flex-col items-center" style={{ gap: 12 }} data-testid="first-result">
              <p className="data-label m-0">{result.label}</p>
              <p className="entry-result-figure">
                {result.value}
                {result.unit ? <span className="entry-result-unit">{result.unit}</span> : null}
              </p>
              <p className="zz-body m-0" style={{ maxWidth: 'min(92vw, 28rem)', lineHeight: 1.45 }}>
                {result.detail}
              </p>
              <p className="zz-body m-0" style={{ opacity: 0.7 }}>
                Source: {result.source}
              </p>
            </div>
          ) : (
            <h1
              className="zz-h3 text-display m-0 text-center"
              style={{ maxWidth: 'min(92vw, 28rem)', color: 'var(--color-blue)' }}
              data-testid="first-result-none"
            >
              Your savings for {postcode} are ready to find.
            </h1>
          )}
          <div className="profile-step-controls profile-step-controls--options">
            <ProfileAnswerBtn
              reduceMotion={reduceMotion}
              optionIndex={0}
              delaySeconds={familyControlDelaySec(0)}
              className=""
              onClick={goCreate}
              aria-label="Save this, create your account"
            >
              <span className="profile-answer-btn__text zz-h4">
                SAVE
                <br />
                THIS
              </span>
            </ProfileAnswerBtn>
          </div>
          <p className="zz-body m-0">Save this, create your account.</p>
          <div className="flex flex-col items-center" style={{ gap: 4 }}>
            <button type="button" className="entry-text-link" onClick={goGuest}>
              Skip for now
            </button>
            <button type="button" className="entry-text-link" onClick={goLogin}>
              Log in
            </button>
          </div>
        </>
      )}
    </EntryShell>
  )
}

export default function StartResultPage() {
  return (
    <Suspense fallback={null}>
      <StartResult />
    </Suspense>
  )
}
