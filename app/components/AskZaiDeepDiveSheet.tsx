'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP, ZIP_OPEN_Z_TRANSITION } from '@/lib/animations'

type Props = {
  open: boolean
  onClose: () => void
  headline: string
  category: string
  suggestedQuestions: string[]
  onSubmitQuestion: (question: string) => void | Promise<void>
}

export function AskZaiDeepDiveSheet({
  open,
  onClose,
  headline,
  category,
  suggestedQuestions,
  onSubmitQuestion,
}: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (q: string) => {
      const text = q.trim()
      if (!text || busy) return
      setBusy(true)
      try {
        await onSubmitQuestion(text)
        onClose()
      } finally {
        setBusy(false)
      }
    },
    [busy, onClose, onSubmitQuestion]
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
              maxHeight: 'min(72dvh, 520px)',
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              background: '#FFFF00',
              color: '#141268',
              padding: 'clamp(24px, 5vw, 40px)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <p className="zz-label m-0 uppercase" style={{ letterSpacing: '0.08em', opacity: 0.85 }}>
              {category}
            </p>
            <h2
              id="ask-zai-deep-dive-title"
              className="m-0 text-marvin uppercase"
              style={{ fontSize: 'clamp(22px, 5vw, 30px)', lineHeight: 0.95 }}
            >
              Deep dive
            </h2>
            <p className="m-0" style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.35 }}>
              {headline}
            </p>
            <motion.div className="flex flex-wrap gap-3" style={{ gap: 12 }}>
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
                    padding: '12px 18px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {q}
                </button>
              ))}
            </motion.div>
            <form
              className="flex flex-col gap-3 mt-auto"
              onSubmit={(e) => {
                e.preventDefault()
                void submit(draft)
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about this shift…"
                className="w-full rounded-full border-0 px-5 h-12 text-marvin uppercase"
                style={{
                  background: '#141268',
                  color: '#FFFF00',
                  fontSize: 14,
                }}
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
                }}
              >
                {busy ? 'Searching…' : 'Search deeper'}
              </button>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
