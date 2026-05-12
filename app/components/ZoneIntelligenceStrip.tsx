'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { MECHANICAL_SNAP_SPRING } from '@/lib/animations'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'

const TICK = '✓'
const CROSS = '✗'

function BulletRow({
  ok,
  title,
  source,
  detail,
}: {
  ok: boolean
  title: string
  source: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <p
        className="pulse-diagnostic-label m-0 flex items-baseline gap-2"
        style={{ color: 'var(--color-yellow)' }}
      >
        <span aria-hidden style={{ color: ok ? 'var(--color-yellow)' : 'var(--color-pink)' }}>
          {ok ? TICK : CROSS}
        </span>
        <span>{title}</span>
      </p>
      <p
        className={`pulse-diagnostic-value opacity-90 ${detail ? '!mb-1' : '!mb-2 last:!mb-0'}`}
        style={{ paddingLeft: '1.35rem' }}
      >
        {source}
      </p>
      {detail ? (
        <p
          className="pulse-diagnostic-value !mb-2 last:!mb-0"
          style={{
            paddingLeft: '1.35rem',
            fontSize: 10,
            lineHeight: 1.25,
            opacity: 0.72,
            wordBreak: 'break-word',
          }}
        >
          {detail}
        </p>
      ) : null}
    </div>
  )
}

export type ZoneIntelligenceStripProps = {
  variant?: 'zone' | 'likes'
  /** Hide FAB + panel while Solo Focus / tip overlay is open (Zone page). */
  suppressOverlay?: boolean
  /** Dev-only line (e.g. grid / focus counts) — shown at bottom of the panel when open. */
  debugHudLine?: string
  /** When DB ping fails, short reason (never contains secrets). */
  dbHealthHint?: string | null
  dbConnected?: boolean
  neonVerifiedMoney?: boolean
  verifiedSaving?: number
  savingAmountGbp?: number
  localityLabel?: string
  gridGPerKwh?: number
  researchCategory?: string | null
  hasArchitectProse?: boolean
  hasOfferUrl?: boolean
  /** Logged-in Zone: per-journey `research_results` coverage (GET /api/scrape-sync). */
  categoryCoverage?: Record<string, ResearchCategoryCoverageRow> | null
  rightAside?: ReactNode
}

/**
 * Intelligence loop — same shell as {@link PulseWidget}: triangle FAB + `pulse-diagnostic-panel`.
 * Portals to `document.body` so `position:fixed` is not trapped by transformed ancestors.
 */
export function ZoneIntelligenceStrip({
  variant = 'zone',
  suppressOverlay = false,
  debugHudLine,
  dbHealthHint,
  dbConnected = true,
  neonVerifiedMoney = false,
  verifiedSaving,
  savingAmountGbp,
  localityLabel,
  gridGPerKwh,
  researchCategory,
  hasArchitectProse = false,
  hasOfferUrl = false,
  categoryCoverage = null,
  rightAside,
}: ZoneIntelligenceStripProps) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (suppressOverlay) {
      setOpen(false)
    }
  }, [suppressOverlay])

  const localOk =
    Boolean((localityLabel ?? '').trim()) ||
    (typeof gridGPerKwh === 'number' && Number.isFinite(gridGPerKwh))
  const covRows = categoryCoverage ? Object.values(categoryCoverage) : []
  const covInsight = covRows.some((c) => c.insightReady)
  const covOffer = covRows.some((c) => c.hasOffer)
  const proseOk = covInsight || hasArchitectProse
  const offerOk = covOffer || hasOfferUrl
  const rowOk = proseOk && offerOk

  const moneyHint =
    typeof verifiedSaving === 'number' && verifiedSaving > 0
      ? `verified_saving ≈ £${Math.round(verifiedSaving).toLocaleString('en-GB')}`
      : typeof savingAmountGbp === 'number' && savingAmountGbp > 0
        ? `saving_amount_gbp £${Math.round(savingAmountGbp).toLocaleString('en-GB')}`
        : covRows.some((c) => (c.latestSavingGbp ?? 0) > 0 || (c.latestVerifiedGbp ?? 0) > 0)
          ? 'per-category rows in research_results'
          : null

  if (!mounted || typeof document === 'undefined') return null
  if (suppressOverlay) return null

  const yellow = 'var(--color-yellow)'

  const panelInner =
    variant === 'likes' ? (
      <>
        <BulletRow ok={dbConnected} title="NEON (LONDON)" source="GET /api/health (public DB ping)" detail={dbHealthHint ?? undefined} />
        <BulletRow ok title="SAVED TILES" source="Last Zone view model in this browser" />
        <p className="pulse-diagnostic-label mt-2 mb-0">ZONE LIVE PIPELINE</p>
        <p className="pulse-diagnostic-value !mb-0">
          Open Zone — GET /api/scrape-sync → research_results
        </p>
      </>
    ) : (
      <>
        <BulletRow
          ok={dbConnected}
          title="NEON DATABASE"
          source="GET /api/health (public DB ping)"
          detail={dbHealthHint ?? undefined}
        />
        <BulletRow
          ok={
            neonVerifiedMoney ||
            covRows.some((c) => (c.latestSavingGbp ?? 0) > 0 || (c.latestVerifiedGbp ?? 0) > 0)
          }
          title="RESEARCH £ ROW"
          source={
            moneyHint
              ? `GET /api/scrape-sync → research_results (${moneyHint})`
              : 'GET /api/scrape-sync → research_results'
          }
        />
        <BulletRow
          ok={localOk}
          title="LOCALITY + GRID"
          source={
            localOk
              ? `POST /api/local-intelligence${localityLabel ? ` · ${localityLabel}` : ''}${typeof gridGPerKwh === 'number' && Number.isFinite(gridGPerKwh) ? ` · ~${Math.round(gridGPerKwh)} gCO₂/kWh` : ''}`
              : 'POST /api/local-intelligence (+ Postcodes.io)'
          }
        />
        <BulletRow
          ok={proseOk}
          title="ARCHITECT PROSE"
          source={
            categoryCoverage && covInsight
              ? `research_results.architect_prose · ${covRows.filter((c) => c.insightReady).length} categories`
              : researchCategory
                ? `research_results.architect_prose · ${researchCategory}`
                : 'research_results.architect_prose (Solo Focus copy)'
          }
        />
        <BulletRow ok={offerOk} title="OFFER URL" source="research_results.offer_url (CTA handoff)" />
        <BulletRow ok={rowOk} title="TRUE TIP ROW" source="Prose + link for matched category" />
        {rightAside ? (
          <div
            className="mt-3 pt-2"
            style={{
              borderTop: '1px solid rgba(253, 253, 0, 0.28)',
              fontFamily: 'var(--font-marvin)',
              fontSize: 11,
              lineHeight: 1.2,
              color: yellow,
            }}
          >
            {rightAside}
          </div>
        ) : null}
      </>
    )

  const node = (
    <div className="pulse-diagnostic-anchor pointer-events-none fixed bottom-8 right-8 z-[99] flex flex-col items-end gap-2">
      <AnimatePresence>
        {open ? (
          <motion.div
            id="zz-intelligence-loop-panel"
            key="intel-loop-panel"
            initial={{ scale: 0.94, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 1 }}
            transition={MECHANICAL_SNAP_SPRING}
            className="pointer-events-auto pulse-diagnostic-panel relative w-[min(100vw-2rem,22rem)] max-h-[min(72dvh,520px)] overflow-y-auto"
          >
            <motion.button
              type="button"
              aria-label="Close intelligence loop"
              onClick={close}
              className="pulse-panel-close-circle"
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.12 }}
            >
              <BackArrowDownLeft size={22} />
            </motion.button>

            <div className="flex w-full min-w-0 flex-col pr-14 text-left">
              <p className="pulse-diagnostic-label mb-2">INTELLIGENCE LOOP</p>
              {panelInner}
              {debugHudLine ? (
                <pre
                  data-testid="zone-debug-state"
                  className="m-0 mt-3 overflow-x-auto rounded-lg p-2 text-left"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 11,
                    lineHeight: 1.35,
                    color: yellow,
                    background: 'rgba(0,0,0,0.38)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {debugHudLine}
                </pre>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls="zz-intelligence-loop-panel"
        aria-label={open ? 'Close intelligence loop' : 'Open intelligence loop'}
        onClick={() => setOpen((o) => !o)}
        className="pulse-triangle-fab pointer-events-auto"
        whileTap={{ scale: 0.96 }}
        transition={MECHANICAL_SNAP_SPRING}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ color: yellow }}>
          <path d="M12 3L22 20H2L12 3z" fill="currentColor" />
        </svg>
      </motion.button>
    </div>
  )

  return createPortal(node, document.body)
}
