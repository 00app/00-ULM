'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP, ZIP_OPEN_Z_TRANSITION } from '@/lib/animations'
import { postZaiChat, readZaiStream } from '@/lib/zai/chatClient'
import { triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import { buildSoloFocusAskZaiQuestion } from '@/lib/expandStorage'
import { sanitizeText } from '@/lib/sanitize'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { useApp } from '@/app/context/AppContext'

const ZAI_FALLBACK = "give me a sec — still checking what's live near you."

function getJourneyAnswersFromClient(): Record<string, Record<string, string>> | undefined {
  if (typeof window === 'undefined') return undefined
  const out: Record<string, Record<string, string>> = {}
  for (const jid of JOURNEY_ORDER) {
    try {
      const raw = localStorage.getItem(`journey_${jid}_answers`)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, string> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') cleaned[k] = v
        }
        if (Object.keys(cleaned).length > 0) out[jid] = cleaned
      }
    } catch {
      // ignore
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

type Props = {
  open: boolean
  onClose: () => void
  headline: string
  category: string
  journeyKey: string
  personalSpend?: string
  regionalAvg?: string
  scrapedSource?: string
  postcode?: string | null
  suggestedQuestions: string[]
}

export function AskZaiDeepDiveSheet({
  open,
  onClose,
  headline,
  category,
  journeyKey,
  personalSpend = '0',
  regionalAvg = '0',
  scrapedSource = '',
  postcode: postcodeProp,
  suggestedQuestions,
}: Props) {
  const { state } = useApp()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState('')
  const answerRef = useRef<HTMLParagraphElement>(null)

  const postcode =
    postcodeProp ??
    state.profile?.postcode ??
    (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') : null)

  useEffect(() => {
    if (!open) {
      setDraft('')
      setAnswer('')
      setBusy(false)
    }
  }, [open])

  const runLocalizedScrape = useCallback(
    (question: string) => {
      const pc = String(postcode ?? '').replace(/\s+/g, '').trim()
      if (pc.length < 4) return
      const areaHint =
        pc.startsWith('BN') || pc.startsWith('RH') || pc.startsWith('PO')
          ? 'West Sussex'
          : 'UK'
      triggerScrapeSyncForCategory({
        postcode: pc,
        category: journeyKey,
        profileData: state.profile
          ? {
              postcode: state.profile.postcode,
              home_type: state.profile.homeType,
              household: state.profile.livingSituation,
              transport_baseline: state.profile.transport,
            }
          : null,
        bestOfferHint: `Search for energy grants and lifestyle shifts available in ${areaHint}, UK for a residential property in May 2026. User question: ${question.slice(0, 200)}`,
      })
    },
    [journeyKey, postcode, state.profile]
  )

  const submit = useCallback(
    async (q: string) => {
      const label = q.trim()
      if (!label || busy) return
      setBusy(true)
      setAnswer('')
      runLocalizedScrape(label)

      const journeyAnswers = getJourneyAnswersFromClient()
      const questionForApi = buildSoloFocusAskZaiQuestion(headline, label)
      const totals = state.heroTotals ?? { totalMoney: 0, totalCarbon: 0 }

      try {
        const res = await postZaiChat({
          question: questionForApi,
          stream: true,
          journey_answers: journeyAnswers,
          postcode: postcode ?? undefined,
          expandedContext: {
            category: journeyKey,
            personalSpend,
            regionalAvg,
            shift_title: headline,
            scraped_source: scrapedSource,
            journey_question_label: label,
            journey_answers_jsonb: journeyAnswers,
          },
          contextData: {
            totals,
            postcode: postcode ?? undefined,
          },
        })

        if (!res.ok) {
          setAnswer(ZAI_FALLBACK)
          return
        }

        let streamed = ''
        await readZaiStream(res, (chunk) => {
          streamed += chunk
          setAnswer(sanitizeText(streamed))
        })
        if (!streamed.trim()) setAnswer(ZAI_FALLBACK)
        requestAnimationFrame(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
      } catch {
        setAnswer(ZAI_FALLBACK)
      } finally {
        setBusy(false)
      }
    },
    [
      busy,
      headline,
      journeyKey,
      personalSpend,
      regionalAvg,
      postcode,
      runLocalizedScrape,
      scrapedSource,
      state.heroTotals,
    ]
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="ask-zai-deep-dive-scrim"
            aria-label="Close deep dive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={INDUSTRIAL_OPACITY_SNAP}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 240,
              background: 'color-mix(in srgb, #141268 55%, transparent)',
              border: 'none',
              cursor: 'pointer',
            }}
          />
          <motion.div
            className="ask-zai-deep-dive-sheet"
            role="dialog"
            aria-modal
            aria-labelledby="ask-zai-deep-dive-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={ZIP_OPEN_Z_TRANSITION}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 241,
              maxHeight: 'min(80dvh, 560px)',
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              background: '#FFFF00',
              color: '#141268',
              padding: 'clamp(20px, 4vw, 32px)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <motion.div className="ask-zai-deep-dive-inner">
              <p className="zz-label m-0 uppercase" style={{ letterSpacing: '0.08em', opacity: 0.85 }}>
                {category}
              </p>
              <h2
                id="ask-zai-deep-dive-title"
                className="m-0 text-marvin uppercase"
                style={{ fontSize: 'clamp(22px, 4vw, 28px)', lineHeight: 0.95 }}
              >
                Deep dive
              </h2>
              <p className="m-0" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: 1.35 }}>
                {headline}
              </p>
              <div className="flex flex-wrap gap-3" style={{ gap: 12 }}>
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={busy}
                    onClick={() => void submit(q)}
                    className="rounded-full border-0 cursor-pointer uppercase text-marvin"
                    style={{
                      background: '#141268',
                      color: '#FFFF00',
                      padding: '10px 16px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              {answer ? (
                <p ref={answerRef} className="ask-zai-deep-dive-answer">
                  {answer}
                </p>
              ) : null}
              <form
                className="flex flex-col gap-3 mt-auto max-w-zone w-full"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit(draft)
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about this shift…"
                  className="ask-zai-deep-dive-input"
                  style={{ background: '#141268', color: '#FFFF00' }}
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="rounded-full border-0 h-12 uppercase text-marvin cursor-pointer"
                  style={{
                    background: busy ? 'color-mix(in srgb, #141268 60%, #FFFF00)' : '#141268',
                    color: '#FFFF00',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {busy ? 'Auditing…' : 'Search deeper'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
