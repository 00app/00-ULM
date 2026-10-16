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
import { persistUnifiedUserProfileMemory } from '@/lib/unifiedProfileMemory'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'
import type { FirstResult } from '@/lib/entry/firstResult'
import { SecondaryCircleCta } from '@/app/components/ui/SecondaryCircleCta'

type Phase = 'loading' | 'ready' | 'not_found'

/**
 * Entry step 3: up to four real insights for this postcode (energy, carbon, solar, home), laid
 * out as figure-left / sentence-right rows, then a single START circle (creates the account).
 * Mechanical truth: an insight whose source returns nothing is omitted; if none return, the
 * figures are omitted and the action is still shown. Nothing here estimates or defaults a number.
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
    // The URL is the source of truth for this screen. If storage lost the postcode (a reset, a
    // second tab, a cleared cache), put it back so Skip / Create carry it forward.
    try {
      if (!localStorage.getItem(PROFILE_STORAGE_KEYS.postcode)?.trim()) {
        localStorage.setItem(PROFILE_STORAGE_KEYS.postcode, pc)
        persistUnifiedUserProfileMemory()
      }
    } catch {
      /* storage blocked */
    }
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

  if (phase === 'not_found') {
    return (
      <EntryShell>
        <h1 className="zz-h2 text-display m-0 text-center" style={{ color: 'var(--color-blue)' }}>
          We can&apos;t find that postcode.
        </h1>
        <SecondaryCircleCta ariaLabel="Try another postcode" onClick={() => router.replace(ROUTES.START)}>
          TRY
          <br />
          ANOTHER
        </SecondaryCircleCta>
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
            <section className="entry-insights" data-testid="first-result" aria-label={`What we found for ${postcode}`}>
              <p className="data-label m-0 entry-insights__heading">{postcode} right now</p>
              {result.insights.map((insight) => (
                <div key={insight.category} className="entry-insight" data-testid={`first-result-${insight.category}`}>
                  <p className="entry-insight__value">{insight.value}</p>
                  <div className="entry-insight__body">
                    <p className="data-label m-0">{insight.label}</p>
                    <p className="entry-insight__text">{insight.text}</p>
                    <p className="entry-insight__source">Source: {insight.source}</p>
                  </div>
                </div>
              ))}
            </section>
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
              aria-label="Start"
            >
              <span className="profile-answer-btn__text zz-h4">START</span>
            </ProfileAnswerBtn>
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
