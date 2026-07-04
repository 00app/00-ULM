'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP, ZIP_OPEN_Z_TRANSITION } from '@/lib/animations'
import { postZaiChat, readZaiStream, type ZaiChatMessage } from '@/lib/zai/chatClient'
import { triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import { buildSoloFocusAskZaiQuestion, setAskZaiContext } from '@/lib/expandStorage'
import { ZAI_FALLBACK_CONNECTING } from '@/lib/zai/chatBoundaries'
import { polishZaiBodyCopy } from '@/lib/zai/polishBodyCopy'
import { renderZaiChatProse } from '@/lib/zai/renderChatProse'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { ROUTES } from '@/lib/routes'
import { useApp } from '@/app/context/AppContext'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import {
  buildDeepDivePlainSummary,
  buildDeepDiveQuestionPills,
  type DeepDiveProfileSlice,
} from '@/lib/zai/deepDiveAudit'
import { scrapeAreaHintFromLocality } from '@/lib/zai/scrapeAreaHint'

const ZAI_FALLBACK = ZAI_FALLBACK_CONNECTING

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
      /* ignore */
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
  cardId?: string
  sourceUrl?: string
  personalSpend?: string
  regionalAvg?: string
  scrapedSource?: string
  postcode?: string | null
  localityName?: string | null
  profileSlice?: DeepDiveProfileSlice | null
  suggestedQuestions?: string[]
}

export function AskZaiDeepDiveSheet({
  open,
  onClose,
  headline,
  category,
  journeyKey,
  cardId = '',
  sourceUrl = '',
  personalSpend = '0',
  regionalAvg = '0',
  scrapedSource = '',
  postcode: postcodeProp,
  localityName,
  profileSlice,
  suggestedQuestions,
}: Props) {
  const router = useRouter()
  const { state } = useApp()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ZaiChatMessage[]>([])
  const threadEndRef = useRef<HTMLDivElement>(null)

  const postcode =
    postcodeProp ??
    state.profile?.postcode ??
    (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') : null)

  const locality =
    localityName ?? state.locationState?.locationName ?? state.profile?.postcode ?? null

  const auditInput = useMemo(
    () => {
      const profile: DeepDiveProfileSlice = profileSlice ?? {
        homeType: state.profile?.homeType,
        transport: state.profile?.transport,
        livingSituation: state.profile?.livingSituation,
        postcode: state.profile?.postcode,
      }
      return {
        journeyKey,
        categoryLabel: category,
        headline,
        personalSpend,
        regionalAvg,
        scrapedSource,
        localityName: locality,
        profile,
        journeyAnswers: getJourneyAnswersFromClient(),
      }
    },
    [
      journeyKey,
      category,
      headline,
      personalSpend,
      regionalAvg,
      scrapedSource,
      locality,
      profileSlice,
      state.profile?.homeType,
      state.profile?.transport,
      state.profile?.livingSituation,
      state.profile?.postcode,
    ]
  )

  const plainSummary = useMemo(() => buildDeepDivePlainSummary(auditInput), [auditInput])
  const transitionPills = useMemo(
    () => suggestedQuestions ?? buildDeepDiveQuestionPills(journeyKey),
    [suggestedQuestions, journeyKey]
  )

  useEffect(() => {
    if (!open) {
      setDraft('')
      setMessages([])
      setBusy(false)
      return
    }
    const answers = getJourneyAnswersFromClient()
    setAskZaiContext({
      category: journeyKey,
      personalSpend,
      regionalAvg,
      question: buildSoloFocusAskZaiQuestion(headline, null),
      shift_title: headline,
      card_id: cardId || undefined,
      card_title: headline,
      source_url: sourceUrl || scrapedSource || undefined,
      scraped_source: scrapedSource,
      journey_answers_jsonb: answers,
    })
    if (typeof document === 'undefined') return
    document.body.classList.add('ask-zai-deep-dive-active')
    return () => document.body.classList.remove('ask-zai-deep-dive-active')
  }, [
    open,
    journeyKey,
    personalSpend,
    regionalAvg,
    headline,
    cardId,
    sourceUrl,
    scrapedSource,
  ])

  useEffect(() => {
    if (!open) return
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, open])

  const runLocalizedScrape = useCallback(
    (question: string) => {
      const pc = String(postcode ?? '').replace(/\s+/g, '').trim()
      if (pc.length < 4) return
      const areaHint = scrapeAreaHintFromLocality(locality)
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
    [journeyKey, locality, postcode, state.profile]
  )

  const continueInZai = useCallback(
    (pillLabel: string) => {
      const label = pillLabel.trim()
      if (!label) return
      const answers = getJourneyAnswersFromClient()
      setAskZaiContext({
        category: journeyKey,
        personalSpend,
        regionalAvg,
        question: buildSoloFocusAskZaiQuestion(headline, label),
        shift_title: headline,
        card_id: cardId || undefined,
        card_title: headline,
        source_url: sourceUrl || scrapedSource || undefined,
        scraped_source: scrapedSource,
        journey_answers_jsonb: answers,
        journey_question_label: label,
      })
      onClose()
      router.push(ROUTES.ZAI)
    },
    [headline, journeyKey, onClose, personalSpend, regionalAvg, router, scrapedSource, cardId, sourceUrl]
  )

  const submit = useCallback(
    async (q: string) => {
      const label = q.trim()
      if (!label || busy) return
      setBusy(true)
      setDraft('')

      const prior = messages
      const userTurn: ZaiChatMessage = { role: 'user', text: label }
      const transcript = [...prior, userTurn]
      setMessages([...transcript, { role: 'zai', text: '' }])

      runLocalizedScrape(label)

      const journeyAnswersLocal = getJourneyAnswersFromClient()
      const questionForApi = buildSoloFocusAskZaiQuestion(headline, label)
      const totals = state.heroTotals ?? { totalMoney: 0, totalCarbon: 0 }

      try {
        const res = await postZaiChat({
          question: questionForApi,
          stream: true,
          messages: prior,
          journey_answers: journeyAnswersLocal,
          postcode: postcode ?? undefined,
          expandedContext: {
            category: journeyKey,
            personalSpend,
            regionalAvg,
            shift_title: headline,
            scraped_source: scrapedSource,
            journey_question_label: label,
            journey_answers_jsonb: journeyAnswersLocal,
          },
          contextData: {
            totals,
            postcode: postcode ?? undefined,
          },
        })

        if (!res.ok) {
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') {
              next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
            }
            return next
          })
          return
        }

        let streamed = ''
        await readZaiStream(res, (chunk) => {
          streamed += chunk
          const safe = polishZaiBodyCopy(streamed)
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') {
              next[next.length - 1] = { role: 'zai', text: safe }
            }
            return next
          })
        })
        const finalText = streamed.trim() ? polishZaiBodyCopy(streamed) : ZAI_FALLBACK
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') {
            next[next.length - 1] = { role: 'zai', text: finalText }
          }
          return next
        })
      } catch {
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') {
            next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
          } else {
            next.push({ role: 'zai', text: ZAI_FALLBACK })
          }
          return next
        })
      } finally {
        setBusy(false)
      }
    },
    [
      busy,
      headline,
      journeyKey,
      messages,
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
            onTap={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 240,
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
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
              width: '100%',
              zIndex: 241,
              maxHeight: 'min(78dvh, 560px)',
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              padding: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header className="ask-zai-deep-dive-header shrink-0">
              <h2 id="ask-zai-deep-dive-title" className="ask-zai-deep-dive-title zz-h3 m-0 text-marvin">
                ask zai
              </h2>
            </header>

            <div className="ask-zai-deep-dive-inner">
              <p className="ask-zai-deep-dive-lead m-0">{plainSummary}</p>

              <div className="ask-zai-deep-dive-pill-row flex flex-wrap">
                {transitionPills.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={busy}
                    onClick={() => continueInZai(q)}
                    className="ask-zai-deep-dive-pill rounded-full border-0 cursor-pointer uppercase text-marvin"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {messages.length > 0 ? (
                <div className="ask-zai-deep-dive-thread" aria-live="polite">
                  {messages.map((msg, i) =>
                    msg.role === 'user' ? (
                      <p key={`u-${i}`} className="ask-zai-deep-dive-user-turn m-0 uppercase">
                        {msg.text}
                      </p>
                    ) : (
                      <div
                        key={`z-${i}`}
                        className="ask-zai-deep-dive-bubble ask-zai-deep-dive-bubble--zai"
                      >
                        {msg.text
                          ? renderZaiChatProse(msg.text, { journey_key: journeyKey, source: 'zai_chat' })
                          : busy && i === messages.length - 1
                            ? 'Auditing…'
                            : null}
                      </div>
                    )
                  )}
                  <div ref={threadEndRef} />
                </div>
              ) : null}
            </div>
          </motion.div>

          {/* Inlined instead of <ZaiComposerDock> — that component does its own createPortal,
              and nesting a second portal inside this sheet's own portal (under AnimatePresence)
              made the Go button intermittently miss real tap/click events (confirmed: a native
              .click() worked, a coordinate-based tap did not). One portal boundary is enough. */}
          <motion.div
            className="zai-composer-dock zai-composer-dock--fixed zai-composer-dock--ask-sheet"
            initial={FAMILY_ATOMIC_SURFACE_INITIAL}
            animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            <div className="zai-input-row">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit(draft)
                }}
                placeholder="ask zai about this"
                disabled={busy}
                className="zz-zai-composer-input"
              />
              <motion.button
                type="button"
                onClick={() => void submit(draft)}
                onTap={() => void submit(draft)}
                disabled={!draft.trim() || busy}
                className="zai-go-btn ask-zai-sheet-go-btn zz-h4 text-marvin"
                style={{ touchAction: 'manipulation' }}
                transition={INDUSTRIAL_OPACITY_SNAP}
                aria-busy={busy}
              >
                {busy ? '…' : 'Go'}
              </motion.button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
