'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

export type SoloFocusDiagnosticFooterProps = {
  /** Human-readable supplier / attribution for this card. */
  providerName: string
  /** Canonical source URL when available (https…). */
  sourceUrl: string
}

/**
 * Triangle diagnostic — same pattern as Pulse FAB (60px circle): tap to reveal
 * provider + source_url for *this* Solo Focus surface only.
 */
export function SoloFocusDiagnosticFooter({ providerName, sourceUrl }: SoloFocusDiagnosticFooterProps) {
  const [open, setOpen] = useState(false)
  const hasUrl = sourceUrl.trim().startsWith('http')
  const displayProvider = providerName.trim() || '—'

  return (
    <div className="solo-focus-diagnostic-footer w-full mt-6 flex flex-col items-stretch gap-2 text-left">
      <motion.button
        type="button"
        aria-expanded={open}
        aria-label="Show data source for this card"
        onClick={() => setOpen((o) => !o)}
        className="solo-focus-diagnostic-trigger flex h-[60px] w-[60px] shrink-0 items-center justify-center self-start rounded-full border-0 bg-[var(--color-purple)]"
        transition={INDUSTRIAL_OPACITY_SNAP}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="var(--color-yellow)" aria-hidden>
          <path d="M12 3L22 20H2L12 3z" />
        </svg>
      </motion.button>
      <>
        {open ? (
          <motion.div
            key="solo-focus-diag-panel"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={INDUSTRIAL_OPACITY_SNAP}
            className="overflow-hidden rounded-[60px] border-0 bg-[var(--color-purple)] text-left"
            style={{ padding: 'var(--padding-bento)' }}
          >
            <p
              className="m-0 text-left zz-body"
              style={{ color: 'var(--color-yellow)', fontSize: 'calc(var(--zz-body-size) * 0.7)' }}
            >
              <span
                className="block font-bold uppercase tracking-wide text-marvin"
                style={{ fontSize: 'calc(var(--zz-body-size) * 0.55)', lineHeight: 'var(--zz-lh-heading)' }}
              >
                provider_name
              </span>
              {displayProvider}
            </p>
            <p
              className="m-0 mt-3 text-left zz-body break-all"
              style={{ color: 'var(--color-yellow)', fontSize: 'calc(var(--zz-body-size) * 0.7)' }}
            >
              <span
                className="block font-bold uppercase tracking-wide text-marvin"
                style={{ fontSize: 'calc(var(--zz-body-size) * 0.55)', lineHeight: 'var(--zz-lh-heading)' }}
              >
                source_url
              </span>
              {hasUrl ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {sourceUrl}
                </a>
              ) : (
                <span>—</span>
              )}
            </p>
          </motion.div>
        ) : null}
      </>
    </div>
  )
}
