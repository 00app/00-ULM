'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import EntryShell from '@/app/components/EntryShell'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
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
 * Entry step 3: the place played back, then up to four real insights for this postcode
 * (energy, carbon, solar, home), one H2 sentence at a time, then straight on to the first
 * onboarding question (create). No buttons.
 * Mechanical truth: an insight whose source returns nothing is omitted; if none return, only
 * the place line shows. Nothing here estimates or defaults a number.
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
        <FirstResultSequence
          lines={buildSequence(result, postcode)}
          testId={result ? 'first-result' : 'first-result-none'}
          reduceMotion={reduceMotion}
          onDone={goCreate}
        />
      )}
    </EntryShell>
  )
}

type SequenceLine = { key: string; sentence: string; source?: string }

/** Place played back first, then one sentence per live insight. */
function buildSequence(result: FirstResult | null, postcode: string): SequenceLine[] {
  const place = result?.place?.trim() || postcode
  if (!result) {
    return [{ key: 'place', sentence: `Let's find what you could save in ${place}.` }]
  }
  return [
    { key: 'place', sentence: `Here's what living in ${place} costs right now.` },
    ...result.insights.map((i) => ({ key: i.category, sentence: i.sentence, source: i.source })),
  ]
}

/** Reading time for one H2 line: a base beat plus ~300ms a word, clamped. */
function holdMsFor(sentence: string): number {
  const words = sentence.trim().split(/\s+/).length
  return Math.min(4800, Math.max(2400, 900 + words * 300))
}

/**
 * One sentence at a time at H2 size: fade/rise in, hold for reading time, fade out, next.
 * After the last line it hands straight on to the first onboarding question (`onDone`).
 * Tapping the line skips to the next one. Reduced motion keeps the timing, drops the movement.
 */
function FirstResultSequence({
  lines,
  testId,
  reduceMotion,
  onDone,
}: {
  lines: SequenceLine[]
  testId: string
  reduceMotion: boolean
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const finishedRef = useRef(false)

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < lines.length) return i + 1
      if (!finishedRef.current) {
        finishedRef.current = true
        onDoneRef.current()
      }
      return i
    })
  }, [lines.length])

  const line = lines[index]
  useEffect(() => {
    if (!line) return
    const t = window.setTimeout(advance, holdMsFor(line.sentence))
    return () => window.clearTimeout(t)
  }, [line, advance])

  if (!line) return null
  const motionProps = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } }

  return (
    <section
      className="entry-sequence"
      data-testid={testId}
      aria-live="polite"
      onClick={advance}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={line.key}
          className="entry-sequence__line"
          {...motionProps}
          transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="zz-h2 text-display m-0 text-center entry-sequence__sentence">{line.sentence}</h2>
          {line.source ? <p className="entry-sequence__source">Source: {line.source}</p> : null}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

export default function StartResultPage() {
  return (
    <Suspense fallback={null}>
      <StartResult />
    </Suspense>
  )
}
