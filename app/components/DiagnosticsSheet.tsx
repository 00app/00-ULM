'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  STACCATO_CHILD_VARIANTS,
  STACCATO_CONTAINER_VARIANTS,
  STACCATO_TWEEN,
  ZIP_OPEN_Z_TRANSITION,
} from '@/lib/animations'
import {
  pollMechanicalDiagnostics,
  type MechanicalDiagnosticRow,
} from '@/lib/intelligence/mechanicalDiagnostics'

type DiagnosticsSheetProps = {
  open: boolean
  onClose: () => void
  dbConnected: boolean
  dbHealthHint?: string | null
  scrapePostcode?: string
  localityLabel?: string
}

function StatusGlyph({ ok }: { ok: boolean }) {
  return (
    <span className="mechanical-diagnostics-sheet__status" aria-hidden>
      {ok ? '✓' : '—'}
    </span>
  )
}

export default function DiagnosticsSheet({
  open,
  onClose,
  dbConnected,
  dbHealthHint,
  scrapePostcode,
  localityLabel,
}: DiagnosticsSheetProps) {
  const [rows, setRows] = useState<MechanicalDiagnosticRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await pollMechanicalDiagnostics({
        dbConnected,
        dbHealthHint,
        scrapePostcode,
        localityLabel,
      })
      setRows(next)
    } finally {
      setLoading(false)
    }
  }, [dbConnected, dbHealthHint, scrapePostcode, localityLabel])

  useEffect(() => {
    if (!open) return
    void refresh()
    const id = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(id)
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  const allOk = rows.length > 0 && rows.every((r) => r.ok)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="mechanical-diagnostics-scrim"
            aria-label="Close diagnostics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={STACCATO_TWEEN}
            onClick={onClose}
          />
          <motion.div
            className="mechanical-diagnostics-sheet"
            role="dialog"
            aria-modal
            aria-labelledby="mechanical-diagnostics-title"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={ZIP_OPEN_Z_TRANSITION}
          >
            <div className="mechanical-diagnostics-sheet__header">
              <h3 id="mechanical-diagnostics-title" className="mechanical-diagnostics-sheet__title zz-h3 m-0">
                MECHANICAL TRUTH
              </h3>
              <button
                type="button"
                className="mechanical-diagnostics-sheet__close"
                onClick={onClose}
                aria-label="Close diagnostics sheet"
              >
                ×
              </button>
            </div>
            <p className="mechanical-diagnostics-sheet__lead m-0">
              {loading ? 'Auditing flight deck…' : allOk ? 'All systems green.' : 'Some lanes need attention.'}
            </p>
            <motion.div
              className="mechanical-diagnostics-sheet__grid"
              variants={STACCATO_CONTAINER_VARIANTS}
              initial="hidden"
              animate="visible"
            >
              {rows.map((row) => (
                <motion.div
                  key={row.id}
                  className="mechanical-diagnostics-sheet__row"
                  variants={STACCATO_CHILD_VARIANTS}
                >
                  <div className="mechanical-diagnostics-sheet__row-head">
                    <StatusGlyph ok={row.ok} />
                    <span className="mechanical-diagnostics-sheet__component">{row.component}</span>
                  </div>
                  <p className="mechanical-diagnostics-sheet__detail m-0">{row.detail}</p>
                </motion.div>
              ))}
            </motion.div>
            <p className="mechanical-diagnostics-sheet__footer m-0">
              use less, more.{' '}
              <a
                href="https://github.com/00app/00-ULM/blob/main/docs/INTELLIGENCE-LOOP-MANIFEST.md"
                className="mechanical-diagnostics-sheet__map-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Intelligence loop map →
              </a>
            </p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
