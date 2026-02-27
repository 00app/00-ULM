'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import FloatingNav from '@/app/components/FloatingNav'
import { useRouter } from 'next/navigation'
import { useApp } from '@/app/context/AppContext'

const squishBounce = { type: 'spring' as const, stiffness: 600, damping: 15 }

function triggerHaptic(pattern: 'light' | 'medium') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern === 'medium' ? 15 : 5)
  }
}

export default function ZaiPage() {
  const router = useRouter()
  const { state } = useApp()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'zai'; text: string }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const postcode = state.profile?.postcode ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('profile_postcode') : null)

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    triggerHaptic('medium')
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/zai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          contextData: {
            totals: { totalMoney: 0, totalCarbon: 0 },
            postcode: postcode || undefined,
          },
        }),
      })
      const data = await res.json()
      const answer = data.answer ?? "i'm having a moment. try again in a sec."
      setMessages((m) => [...m, { role: 'zai', text: answer }])
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch {
      setMessages((m) => [...m, { role: 'zai', text: "i'm having a moment. try again in a sec." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="zz-page zai-page" style={{ background: 'var(--color-ice)' }}>
      <Link href="/zone" className="zz-page-back zz-label">
        ← Zone
      </Link>
      <h1 className="zz-page-title">Ask Zai</h1>
      <p className="zz-body" style={{ marginBottom: 'var(--gap-lg)' }}>
        Your assistant for tips and questions. Ask Zero anything.
      </p>

      <div className="zai-chat-wrap" style={{ minHeight: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
          {messages.length === 0 && (
            <p className="zz-body" style={{ opacity: 0.7 }}>
              Ask about money, carbon, or any journey. Zai uses UK 2026 data.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: 16,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <span
                className="zz-body zai-bubble"
                style={{
                  display: 'inline-block',
                  padding: '14px 20px',
                  borderRadius: 32,
                  background: msg.role === 'zai' ? 'var(--color-blue)' : 'var(--color-cool)',
                  color: msg.role === 'zai' ? 'var(--color-ice)' : 'var(--color-deep)',
                  maxWidth: '85%',
                }}
              >
                {msg.text}
              </span>
            </div>
          ))}
          {loading && (
            <motion.div
              className="zai-pulse-circle"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--color-blue)',
                marginTop: 16,
              }}
            />
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Zai..."
            className="zone-ask-zai-pill"
            style={{ flex: 1 }}
          />
          <motion.button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="action-circle-80"
            style={{
              width: 80,
              height: 80,
              flexShrink: 0,
              opacity: input.trim() && !loading ? 1 : 0.5,
            }}
            whileTap={{ scale: 0.92 }}
            transition={squishBounce}
          >
            <span className="text-white font-black uppercase text-[10px] tracking-widest">Go</span>
          </motion.button>
        </div>
      </div>

      <FloatingNav
        active="chat"
        onNavigate={(key) => {
          if (key === 'likes') router.push('/likes')
          if (key === 'zone') router.push('/zone')
          if (key === 'summary') router.push('/settings')
          if (key === 'chat') router.push('/zai')
        }}
      />
    </div>
  )
}
