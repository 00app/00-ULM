'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { motion } from 'framer-motion'
import { useApp } from '@/app/context/AppContext'
import { getAskZaiContext, clearAskZaiContext } from '@/lib/expandStorage'
import { sanitizeText } from '@/lib/sanitize'
import { ELASTIC_PING, INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { postZaiChat, readZaiStream } from '@/lib/zai/chatClient'
import type { HeroTotals } from '@/app/context/AppContext'
import type { ZaiChatMeta } from '@/lib/zai/zaiChatUi'
import { metaFromAskZaiContext, metaFromZaiReply } from '@/lib/zai/zaiChatUi'
import { readZaiLikes, removeZaiLike, upsertZaiLike } from '@/lib/zai/zaiLikesStorage'
import Link from 'next/link'
import AppFloatingNav from '@/app/components/AppFloatingNav'

const ZAI_FALLBACK = "give me a sec — still checking what's live near you."
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

function buildColdStartHook(totals: HeroTotals, locality: string | null): string {
  const place = locality?.trim() || 'your area'
  if (totals.totalMoney > 0 || totals.totalCarbon > 0) {
    return sanitizeText(
      `you're on about £${totals.totalMoney}/yr savings and ${totals.totalCarbon}kg carbon in ${place} — what do you want to tackle first?`
    )
  }
  return sanitizeText(
    `hi — i'm zai. tell me what you spend on at home or travel in ${place} and i'll find a real uk saving.`
  )
}

function syncZaiLikeStorage(meta: ZaiChatMeta, liked: boolean): void {
  if (liked) {
    upsertZaiLike({
      id: meta.likeId,
      title: meta.likeTitle,
      journey_key: meta.journeyKey,
      money: meta.savingsGbp > 0 ? `£${meta.savingsGbp}` : '£0',
      carbon: '0kg CO₂',
      sourceUrl: meta.sourceUrl,
    })
  } else {
    removeZaiLike(meta.likeId)
  }
}

export default function ZaiPage() {
  const { state, toggleLike } = useApp()
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
        shift_title: ctx.question,
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
          const safe = sanitizeText(streamed)
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
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .catch(() => {
        setMessages((m) => [...m, { role: 'zai', text: ZAI_FALLBACK }])
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when context exists
  }, [])

  const handleSend = async () => {
    const q = input.trim()
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
        const safe = sanitizeText(streamed)
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: safe }
          return next
        })
      })
      const finalText = streamed.trim() ? sanitizeText(streamed) : ZAI_FALLBACK
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
      setMessages((m) => [...m, { role: 'zai', text: sanitizeText(ZAI_FALLBACK) }])
    } finally {
      setLoading(false)
    }
  }

  const handleZaiLike = useCallback(
    (meta: ZaiChatMeta) => {
      triggerHaptic('medium')
      const liked = state.likedCards.includes(meta.likeId)
      toggleLike(meta.likeId, meta.likeTitle, meta.savingsGbp)
      syncZaiLikeStorage(meta, !liked)
    },
    [state.likedCards, toggleLike]
  )

  return (
    <motion.div
      className="zz-page zai-interface zai-page"
      style={{ background: 'transparent' }}
      {...ELASTIC_PING}
    >
      <ZoneBackToZoneLink />
      <h1 className="zz-page-title zai-page-title max-w-zone">Ask Zai</h1>
      <motion.div className="zai-intro-bubble max-w-zone">
        <p className="zz-body">your savings mate — money, carbon, and the next step at home.</p>
        <p className="zz-body">plain uk advice. short answers. one thing to try.</p>
      </motion.div>

      <motion.div className="zai-chat-wrap" style={{ minHeight: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <motion.div className="max-w-zone" style={{ flex: 1, overflow: 'auto', paddingBottom: 24, width: '100%' }}>
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.role}-${i}`}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={INDUSTRIAL_OPACITY_SNAP}
              style={{
                marginBottom: 16,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <span
                className="zz-body zai-bubble zai-bubble-chat"
                style={{
                  display: 'inline-block',
                  padding: 'var(--padding-bento)',
                  borderRadius: 60,
                  background: msg.role === 'zai' ? 'var(--color-pink)' : 'var(--color-purple)',
                  color: 'var(--color-yellow)',
                  maxWidth: '85%',
                  textWrap: 'balance',
                  overflowWrap: 'anywhere',
                }}
              >
                {msg.text}
              </span>
              {msg.role === 'zai' && msg.meta ? (
                <motion.div
                  className="zai-msg-actions flex flex-col items-start gap-2 mt-2"
                  style={{ maxWidth: '85%' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={INDUSTRIAL_OPACITY_SNAP}
                >
                  {msg.meta.answerHref && msg.meta.answerLabel ? (
                    <Link
                      href={msg.meta.answerHref}
                      className="zz-body underline"
                      style={{ color: 'var(--color-yellow)' }}
                    >
                      {msg.meta.answerLabel}
                    </Link>
                  ) : null}
                  {msg.meta.sourceUrl ? (
                    <a
                      href={msg.meta.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zz-body underline"
                      style={{ color: 'var(--color-yellow)' }}
                    >
                      source
                    </a>
                  ) : null}
                  {msg.meta.showLike ? (
                    <motion.button
                      type="button"
                      aria-label={state.likedCards.includes(msg.meta.likeId) ? 'Unlike' : 'Like'}
                      className="circle-btn zai-like-btn"
                      onClick={() => handleZaiLike(msg.meta!)}
                      style={{
                        width: 60,
                        height: 60,
                        minWidth: 60,
                        minHeight: 60,
                        borderRadius: '50%',
                        backgroundColor: state.likedCards.includes(msg.meta.likeId)
                          ? 'var(--color-yellow)'
                          : 'var(--color-purple)',
                        color: state.likedCards.includes(msg.meta.likeId)
                          ? 'var(--color-purple)'
                          : 'var(--color-yellow)',
                        border: '2px solid var(--color-yellow)',
                      }}
                    >
                      <span className="zz-h4" style={{ lineHeight: 1 }}>
                        {state.likedCards.includes(msg.meta.likeId) ? '♥' : '♡'}
                      </span>
                    </motion.button>
                  ) : null}
                </motion.div>
              ) : null}
            </motion.div>
          ))}
          {loading && (
            <motion.p
              className="zz-body m-0 mt-2"
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{
                type: 'tween',
                duration: 0.36,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'linear',
              }}
              style={{ color: 'var(--color-yellow)' }}
            >
              connect
            </motion.p>
          )}
          <motion.div ref={bottomRef} />
        </motion.div>

        <motion.div className="zai-input-row max-w-zone">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Zai..."
            className="zone-ask-zai-pill zai-ask-input caret-[var(--color-purple)]"
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
      </motion.div>
      <AppFloatingNav active="chat" />
    </motion.div>
  )
}
