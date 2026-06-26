'use client'

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import ZoneModalCloseLink from '@/app/components/ZoneModalCloseLink'
import ZaiComposerDock from '@/app/components/ZaiComposerDock'
import ZaiSuggestPills from '@/app/components/ZaiSuggestPills'
import { HeartOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { renderZaiChatProse } from '@/lib/zai/renderChatProse'
import { motion } from 'framer-motion'
import { useApp } from '@/app/context/AppContext'
import { getAskZaiContext, clearAskZaiContext } from '@/lib/expandStorage'
import { dispatchZaiAuditComplete } from '@/lib/zai/zoneSync'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import {
  familyAtomicProps,
  familyPageEnterProps,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { postZaiChat, readZaiStream } from '@/lib/zai/chatClient'
import type { HeroTotals } from '@/app/context/AppContext'
import type { ZaiChatMeta } from '@/lib/zai/zaiChatUi'
import { metaFromAskZaiContext, metaFromZaiReply, mergeZaiChatMeta } from '@/lib/zai/zaiChatUi'
import { resolveZaiPickHandoff } from '@/lib/zai/resolveZaiLikeHandoff'
import { readZaiLikes, removeZaiLike, upsertZaiLike } from '@/lib/zai/zaiLikesStorage'
import { ZAI_INTRO_LINES } from '@/lib/zai/chatPrompts'
import {
  lastZaiMessageIndex,
  shouldShowZaiSuggestedPills,
  zaiPillsBelongAfterIntro,
} from '@/lib/zai/chatRules'
import { ZAI_FALLBACK_CONNECTING } from '@/lib/zai/chatBoundaries'
import { polishZaiBodyCopy } from '@/lib/zai/polishBodyCopy'
import Link from 'next/link'

const ZAI_FALLBACK = ZAI_FALLBACK_CONNECTING

function buildColdStartHook(totals: HeroTotals, locality: string | null): string {
  const place = locality?.trim() || 'your patch'
  if (totals.totalMoney > 0 || totals.totalCarbon > 0) {
    return polishZaiBodyCopy(
      `I've got £${totals.totalMoney}/yr and ${totals.totalCarbon}kg on your board in ${place}. Pick a lane — bills, travel, or grants — and I'll narrow it to one move.`
    )
  }
  return polishZaiBodyCopy(
    `I'm Zai — your UK savings mate. Tell me one bill or trip that nags you in ${place}; I'll find a real lever.`
  )
}
const SENTINEL_RECENT_CHAT_KEY = 'zz_recent_chat_history'
const HERO_TOTALS_KEY = 'heroTotals'

type ChatMessage = {
  role: 'user' | 'zai'
  text: string
  meta?: ZaiChatMeta
}

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

function resolveHeroTotals(stateTotals: HeroTotals | null): HeroTotals {
  if (stateTotals && (stateTotals.totalMoney > 0 || stateTotals.totalCarbon > 0)) {
    return stateTotals
  }
  if (typeof window === 'undefined') {
    return stateTotals ?? { totalMoney: 0, totalCarbon: 0 }
  }
  try {
    const raw = window.localStorage.getItem(HERO_TOTALS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as HeroTotals
      if (parsed && typeof parsed.totalMoney === 'number' && typeof parsed.totalCarbon === 'number') {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return stateTotals ?? { totalMoney: 0, totalCarbon: 0 }
}

function triggerHaptic(pattern: 'light' | 'medium') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern === 'medium' ? 15 : 5)
  }
}

function syncZaiLikeStorage(meta: ZaiChatMeta, liked: boolean, postcode?: string | null): void {
  if (liked) {
    const handoff = resolveZaiPickHandoff(
      {
        id: meta.likeId,
        title: meta.likeTitle,
        journey_key: meta.journeyKey,
        money: meta.savingsGbp > 0 ? `£${meta.savingsGbp}` : '£0',
        carbon: '0kg CO₂',
        sourceUrl: meta.sourceUrl,
        offerUrl: meta.offerUrl,
        ctaLabel: meta.ctaLabel,
      },
      postcode
    )
    upsertZaiLike({
      id: meta.likeId,
      title: meta.likeTitle,
      journey_key: meta.journeyKey,
      money: meta.savingsGbp > 0 ? `£${meta.savingsGbp}` : '£0',
      carbon: '0kg CO₂',
      sourceUrl: meta.sourceUrl,
      offerUrl: handoff.offerUrl,
      ctaLabel: handoff.ctaLabel,
    })
  } else {
    removeZaiLike(meta.likeId)
  }
}

export default function ZaiPage() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const { state, toggleLike } = useApp()
  const pageEnter = familyPageEnterProps(reduceMotion)
  const msgMotion = familyAtomicProps(reduceMotion)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const coldStartDone = useRef(false)
  const pendingCtxMeta = useRef<ZaiChatMeta | undefined>(undefined)

  const [postcode, setPostcode] = useState<string | null>(null)
  useEffect(() => {
    setPostcode(
      state.profile?.postcode ??
        (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') ?? null : null)
    )
  }, [state.profile?.postcode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(SENTINEL_RECENT_CHAT_KEY, JSON.stringify(messages.slice(-20)))
    } catch {
      // ignore storage quota/privacy errors
    }
  }, [messages])

  useEffect(() => {
    if (coldStartDone.current) return
    if (getAskZaiContext()) return
    if (messages.length > 0) return
    coldStartDone.current = true
    const totals = resolveHeroTotals(state.heroTotals)
    const locality = state.locationState?.locationName || state.profile?.postcode || postcode
    setMessages([{ role: 'zai', text: buildColdStartHook(totals, locality) }])
  }, [messages.length, postcode, state.heroTotals, state.locationState, state.profile?.postcode])

  const hasConsumedContextRef = useRef(false)
  useEffect(() => {
    if (hasConsumedContextRef.current) return
    const ctx = getAskZaiContext()
    if (!ctx) return
    hasConsumedContextRef.current = true
    clearAskZaiContext()
    const q = ctx.question.trim() || 'How can I close the saving gap for this category?'
    const journeyAnswers = getJourneyAnswersFromClient()
    pendingCtxMeta.current = metaFromAskZaiContext(ctx, journeyAnswers)
    setMessages((m) => [...m, { role: 'user', text: q }])
    setLoading(true)
    const postcodeVal =
      state.profile?.postcode ??
      postcode ??
      (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') ?? null : null)
    const totals = resolveHeroTotals(state.heroTotals)
    void postZaiChat({
      question: q,
      stream: true,
      journey_answers: journeyAnswers,
      postcode: postcodeVal ?? undefined,
      expandedContext: {
        category: ctx.category,
        personalSpend: ctx.personalSpend,
        regionalAvg: ctx.regionalAvg,
        shift_title: ctx.shift_title ?? ctx.question,
        userContext: ctx.userContext,
        scraped_source: ctx.scraped_source,
        journey_answers_jsonb: ctx.journey_answers_jsonb,
        journey_question_label: ctx.journey_question_label ?? undefined,
      },
      contextData: {
        totals,
        postcode: postcodeVal || undefined,
      },
    })
      .then(async (res) => {
        const meta = pendingCtxMeta.current
        setMessages((m) => [...m, { role: 'zai', text: '', meta }])
        if (!res.ok) {
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
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
              next[next.length - 1] = { role: 'zai', text: safe, meta: meta ?? next[next.length - 1]?.meta }
            }
            return next
          })
        })
        if (!streamed.trim()) {
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
            return next
          })
        } else {
          const journeyAnswers = getJourneyAnswersFromClient()
          const finalText = polishZaiBodyCopy(streamed)
          const replyMeta = metaFromZaiReply(finalText, journeyAnswers)
          const merged = mergeZaiChatMeta(meta, replyMeta)
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') {
              next[next.length - 1] = { role: 'zai', text: finalText, meta: merged ?? meta }
            }
            return next
          })
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .catch(() => {
        setMessages((m) => [...m, { role: 'zai', text: ZAI_FALLBACK }])
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when context exists
  }, [])

  const sendQuestion = useCallback(async (rawQ: string) => {
    const q = rawQ.trim()
    if (!q || loading) return
    triggerHaptic('medium')
    setInput('')
    const transcript = [...messages, { role: 'user' as const, text: q }]
    setMessages(transcript)
    setLoading(true)
    try {
      const journeyAnswers = getJourneyAnswersFromClient()
      const totals = resolveHeroTotals(state.heroTotals)
      const res = await postZaiChat({
        question: q,
        stream: true,
        messages: transcript.slice(0, -1),
        journey_answers: journeyAnswers,
        postcode: postcode || undefined,
        contextData: {
          totals,
          postcode: postcode || undefined,
        },
      })
      setMessages((m) => [...m, { role: 'zai', text: '' }])
      if (!res.ok) {
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
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
          if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: safe }
          return next
        })
      })
      const finalText = streamed.trim() ? polishZaiBodyCopy(streamed) : ZAI_FALLBACK
      const meta = metaFromZaiReply(finalText, journeyAnswers)
      setMessages((m) => {
        const next = [...m]
        if (next[next.length - 1]?.role === 'zai') {
          next[next.length - 1] = { role: 'zai', text: finalText, meta }
        }
        return next
      })
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch {
      setMessages((m) => [...m, { role: 'zai', text: ZAI_FALLBACK }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, postcode, state.heroTotals])

  const handleSend = useCallback(() => {
    void sendQuestion(input)
  }, [input, sendQuestion])

  const handleZaiClose = useCallback(() => {
    dispatchZaiAuditComplete()
  }, [])

  const lastZaiIdx = useMemo(() => lastZaiMessageIndex(messages), [messages])
  const showSuggestedPills = shouldShowZaiSuggestedPills(messages, loading)
  const pillsAfterIntro = showSuggestedPills && zaiPillsBelongAfterIntro(messages)

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const handleZaiLike = useCallback(
    (meta: ZaiChatMeta) => {
      triggerHaptic('medium')
      const liked = state.likedCards.includes(meta.likeId)
      toggleLike(meta.likeId, meta.likeTitle, meta.savingsGbp)
      syncZaiLikeStorage(meta, !liked, postcode ?? state.profile?.postcode)
      if (!liked) router.push('/likes')
    },
    [state.likedCards, toggleLike, router, postcode, state.profile?.postcode]
  )

  return (
    <motion.div
      className="zz-page zai-interface zai-page"
      style={{ background: 'transparent' }}
      initial={pageEnter.initial}
      animate={pageEnter.animate}
      transition={pageEnter.transition}
    >
      <ZoneModalCloseLink onClose={handleZaiClose} />

      <div className="zai-page-scroll max-w-zone">
        <h3 className="zz-page-title">zai chat</h3>
        <motion.div className="zai-page-content">
          <motion.div
            className="zai-intro-bubble"
            initial={msgMotion.initial}
            animate={msgMotion.animate}
            transition={FAMILY_TRANSITION_ATOMIC}
          >
            {ZAI_INTRO_LINES.map((line) => (
              <p key={line} className="zz-body">
                {line}
              </p>
            ))}
          </motion.div>

          {pillsAfterIntro ? (
            <ZaiSuggestPills disabled={loading} onPick={(p) => void sendQuestion(p)} />
          ) : null}

          <div className="zai-chat-thread">
            {messages.map((msg, i) => (
              <Fragment key={`${msg.role}-${i}-${msg.text.slice(0, 24)}`}>
                <motion.div
                  className={`zai-chat-msg${msg.role === 'user' ? ' zai-chat-msg--user' : ''}`}
                  initial={msgMotion.initial}
                  animate={msgMotion.animate}
                  transition={FAMILY_TRANSITION_ATOMIC}
                >
                  <span
                    className={`zz-body zai-bubble zai-bubble-chat inline-block max-w-[85%] ${
                      msg.role === 'zai'
                        ? 'zai-bubble-chat--zai zai-prose-voice'
                        : 'zai-bubble-chat--user'
                    }`}
                  >
                    {msg.role === 'zai'
                      ? renderZaiChatProse(msg.text, { journey_key: msg.meta?.journeyKey })
                      : msg.text}
                  </span>
                  {msg.role === 'zai' && msg.meta ? (
                    <motion.div
                      className="zai-msg-footer flex flex-wrap items-center gap-3 mt-2"
                      style={{ maxWidth: '85%' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={INDUSTRIAL_OPACITY_SNAP}
                    >
                      {msg.meta?.answerHref && msg.meta.answerLabel ? (
                        <Link
                          href={msg.meta.answerHref}
                          className="zai-profile-answer-link zz-h4"
                        >
                          {msg.meta.answerLabel}
                        </Link>
                      ) : null}
                      {msg.meta?.sourceUrl ? (
                        <a
                          href={msg.meta.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="zz-body underline"
                          onClick={() => {
                            void fetch('/api/likes/track', {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                url: msg.meta!.sourceUrl,
                                title: msg.meta!.likeTitle,
                                journey_key: msg.meta!.journeyKey,
                              }),
                            })
                          }}
                        >
                          source
                        </a>
                      ) : null}
                      {msg.meta?.showLike ? (
                        <motion.button
                          type="button"
                          aria-label={state.likedCards.includes(msg.meta.likeId) ? 'Unlike' : 'Like'}
                          className="circle-btn zai-like-btn zz-shimmer-cta"
                          onClick={() => handleZaiLike(msg.meta!)}
                          style={{
                            width: 60,
                            height: 60,
                            minWidth: 60,
                            minHeight: 60,
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: state.likedCards.includes(msg.meta.likeId)
                              ? 'var(--brand-select-bg)'
                              : 'var(--color-pink)',
                            color: state.likedCards.includes(msg.meta.likeId)
                              ? 'var(--brand-select-fg)'
                              : 'var(--color-yellow)',
                          }}
                        >
                          <HeartOutlineIcon size={22} />
                        </motion.button>
                      ) : null}
                    </motion.div>
                  ) : null}
                </motion.div>
                {showSuggestedPills && i === lastZaiIdx ? (
                  <ZaiSuggestPills disabled={loading} onPick={(p) => void sendQuestion(p)} />
                ) : null}
              </Fragment>
            ))}
            <div ref={bottomRef} className="zai-thread-end" aria-hidden />
          </div>
        </motion.div>
      </div>

      <ZaiComposerDock>
        {loading ? (
          <motion.p
            className="zz-h4 zai-connecting m-0"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{
              type: 'tween',
              duration: 0.36,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear',
            }}
          >
            zai is auditing user metrics from neon...
          </motion.p>
        ) : null}
        <motion.div className="zai-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ask about a specific shift..."
            className="zz-zai-composer-input"
          />
          <motion.button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="zai-go-btn"
            transition={INDUSTRIAL_OPACITY_SNAP}
          >
            Go
          </motion.button>
        </motion.div>
      </ZaiComposerDock>
    </motion.div>
  )
}
