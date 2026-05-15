'use client'

import { useState, useRef, useEffect } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'
import {
  getAskZaiContext,
  clearAskZaiContext,
} from '@/lib/expandStorage'
import { sanitizeText } from '@/lib/sanitize'

import { ELASTIC_PING, INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import { JOURNEY_ORDER } from '@/lib/journeys'

const ZAI_FALLBACK = "i'm scanning the 2026 grid, try in a sec."
const SENTINEL_RECENT_CHAT_KEY = 'zz_recent_chat_history'

/** Collect journey_answers from localStorage so Zai API can inject context (e.g. "User has GAS heating") */
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

function triggerHaptic(pattern: 'light' | 'medium') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern === 'medium' ? 15 : 5)
  }
}

async function readStreamedAnswer(
  res: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (!chunk) continue
    full += chunk
    onChunk(chunk)
  }
  full += decoder.decode()
  return full
}

export default function ZaiPage() {
  const router = useRouter()
  const { state } = useApp()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'zai'; text: string }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const [postcode, setPostcode] = useState<string | null>(null)
  useEffect(() => {
    setPostcode(state.profile?.postcode ?? (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') ?? null : null))
  }, [state.profile?.postcode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(SENTINEL_RECENT_CHAT_KEY, JSON.stringify(messages.slice(-20)))
    } catch {
      // ignore storage quota/privacy errors
    }
  }, [messages])

  /* Consume Ask Zai context from Expanded View (once per mount): send question with category expert prompt. */
  const hasConsumedContextRef = useRef(false)
  useEffect(() => {
    if (hasConsumedContextRef.current) return
    const ctx = getAskZaiContext()
    if (!ctx) return
    hasConsumedContextRef.current = true
    clearAskZaiContext()
    const q = ctx.question.trim() || 'How can I close the saving gap for this category?'
    setMessages((m) => [...m, { role: 'user', text: q }])
    setLoading(true)
    const postcodeVal = state.profile?.postcode ?? postcode ?? (typeof window !== 'undefined' ? window.localStorage?.getItem?.('profile_postcode') ?? null : null)
    const goalStr = typeof window !== 'undefined' ? window.localStorage?.getItem('profile_goal') : undefined
    const journeyAnswers = getJourneyAnswersFromClient()
    fetch('/api/zai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        stream: true,
        journey_answers: journeyAnswers,
        journeyAnswersFromClient: journeyAnswers,
        expandedContext: {
          category: ctx.category,
          personalSpend: ctx.personalSpend,
          regionalAvg: ctx.regionalAvg,
          userContext: ctx.userContext,
          scraped_source: ctx.scraped_source,
          journey_answers_jsonb: ctx.journey_answers_jsonb,
          journey_question_label: ctx.journey_question_label,
        },
        contextData: {
          totals: { totalMoney: 0, totalCarbon: 0 },
          postcode: postcodeVal || undefined,
          goal: goalStr || undefined,
        },
        postcode: postcodeVal || undefined,
      }),
    })
      .then(async (res) => {
        setMessages((m) => [...m, { role: 'zai', text: '' }])
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          console.error('[zai] Ask-context request failed', res.status, data)
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
            return next
          })
          return
        }
        let streamed = ''
        await readStreamedAnswer(res, (chunk) => {
          streamed += chunk
          const safe = sanitizeText(streamed)
          setMessages((m) => {
            const next = [...m]
            if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: safe }
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
      .catch((err) => {
        console.error('[zai] Ask-context network error', err)
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
      const goalStr = typeof window !== 'undefined' ? window.localStorage?.getItem('profile_goal') : undefined
      const res = await fetch('/api/zai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream: true,
          question: q,
          messages: transcript.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
          journey_answers: journeyAnswers,
          journeyAnswersFromClient: journeyAnswers,
          contextData: {
            totals: state.heroTotals ?? { totalMoney: 0, totalCarbon: 0 },
            postcode: postcode || undefined,
            goal: goalStr || undefined,
          },
          postcode: postcode || undefined,
        }),
      })
      setMessages((m) => [...m, { role: 'zai', text: '' }])
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[zai] /api/zai error', res.status, data)
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: ZAI_FALLBACK }
          return next
        })
        return
      }
      let streamed = ''
      await readStreamedAnswer(res, (chunk) => {
        streamed += chunk
        const safe = sanitizeText(streamed)
        setMessages((m) => {
          const next = [...m]
          if (next[next.length - 1]?.role === 'zai') next[next.length - 1] = { role: 'zai', text: safe }
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
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      console.error('[zai] handleSend network failure', err)
      setMessages((m) => [...m, { role: 'zai', text: sanitizeText(ZAI_FALLBACK) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="zz-page zai-interface zai-page"
      style={{ background: 'transparent' }}
      {...ELASTIC_PING}
    >
      <ZoneBackToZoneLink />
      <h1 className="zz-page-title zai-page-title">Ask Zai</h1>
      <div className="zai-intro-bubble">
        <p className="zz-body">Your assistant for tips and questions. Ask Zero anything.</p>
        <p className="zz-body">Ask about money, carbon, or any journey. Zai uses UK 2026 data.</p>
      </div>

      <div className="zai-chat-wrap" style={{ minHeight: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
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
            </motion.div>
          ))}
          {loading && (
            <motion.div
              className="zai-pulse-circle"
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{
                type: 'tween',
                duration: 0.36,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'linear',
              }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--color-purple)',
                marginTop: 16,
              }}
            />
          )}
          <div ref={bottomRef} />
        </div>

        <div className="zai-input-row" style={{ marginTop: 16 }}>
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
        </div>
      </div>
    </motion.div>
  )
}
