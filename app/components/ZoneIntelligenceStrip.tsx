'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import {
  parseCoverageFromApi,
  parseResearchMetaFromApi,
  researchTicksFromPayload,
} from '@/lib/zone/parseScrapeSyncClient'
import { appendResearchUserIdQuery } from '@/lib/zone/garyMode'

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
  /** Postcode for live scrape-sync diagnostic poll (empty = skip poll). */
  scrapePostcode?: string
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
  scrapePostcode = '',
  rightAside,
}: ZoneIntelligenceStripProps) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  /** From GET /api/health/diagnostics — same booleans as Vercel server env (not a live generate probe). */
  const [apiGemini, setApiGemini] = useState(false)
  const [apiFirecrawl, setApiFirecrawl] = useState(false)
  const [apiAiGateway, setApiAiGateway] = useState(false)
  const [apiAiGatewayOk, setApiAiGatewayOk] = useState(false)
  const [apiAiGatewayFallback, setApiAiGatewayFallback] = useState(false)
  const [apiAiGatewayDetail, setApiAiGatewayDetail] = useState<string | null>(null)
  const [apiDiagReady, setApiDiagReady] = useState(false)
  const [liveResearchTicks, setLiveResearchTicks] = useState<{
    moneyOk: boolean
    proseOk: boolean
    offerOk: boolean
    moneyHint: string | null
  } | null>(null)

  const pollScrapeResearch = useCallback(async () => {
    const pc = (scrapePostcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
    if (pc.length < 4) return
    try {
      const res = await fetch(appendResearchUserIdQuery(`/api/scrape-sync?postcode=${encodeURIComponent(pc)}`), {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      const meta = parseResearchMetaFromApi(data)
      const coverage = parseCoverageFromApi(data)
      setLiveResearchTicks(researchTicksFromPayload(meta, coverage))
    } catch {
      /* non-blocking */
    }
  }, [scrapePostcode])

  const pollApiDiagnostics = useCallback(async () => {
    try {
      const res = await fetch('/api/health/diagnostics', { cache: 'no-store' })
      if (!res.ok) {
        setApiGemini(false)
        setApiFirecrawl(false)
        setApiAiGateway(false)
        setApiAiGatewayOk(false)
        setApiAiGatewayFallback(false)
        setApiAiGatewayDetail(null)
        setApiDiagReady(true)
        return
      }
      const d = (await res.json()) as {
        gemini?: boolean
        firecrawl?: boolean
        aiGateway?: boolean
        aiGatewayOk?: boolean
        aiGatewayFallback?: boolean
        aiGatewayDetail?: string | null
      }
      setApiGemini(Boolean(d.gemini))
      setApiFirecrawl(Boolean(d.firecrawl))
      setApiAiGateway(Boolean(d.aiGateway))
      setApiAiGatewayOk(Boolean(d.aiGatewayOk))
      setApiAiGatewayFallback(Boolean(d.aiGatewayFallback))
      setApiAiGatewayDetail(
        typeof d.aiGatewayDetail === 'string' && d.aiGatewayDetail.trim() ? d.aiGatewayDetail.trim() : null
      )
      setApiDiagReady(true)
    } catch {
      setApiGemini(false)
      setApiFirecrawl(false)
      setApiAiGateway(false)
      setApiAiGatewayOk(false)
      setApiAiGatewayFallback(false)
      setApiAiGatewayDetail(null)
      setApiDiagReady(true)
    }
  }, [])

  useEffect(() => {
    void pollApiDiagnostics()
    const id = setInterval(() => void pollApiDiagnostics(), 15_000)
    return () => clearInterval(id)
  }, [pollApiDiagnostics])

  useEffect(() => {
    if (variant !== 'zone') return
    void pollScrapeResearch()
    const id = setInterval(() => void pollScrapeResearch(), 15_000)
    return () => clearInterval(id)
  }, [pollScrapeResearch, variant])

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
  const propsTicks = researchTicksFromPayload(
    { verifiedSaving, savingAmountGbp, offerUrl: hasOfferUrl ? 'https://local' : undefined },
    categoryCoverage
  )
  const moneyOk =
    neonVerifiedMoney ||
    propsTicks.moneyOk ||
    (liveResearchTicks?.moneyOk ?? false)
  const proseOk =
    hasArchitectProse ||
    propsTicks.proseOk ||
    (liveResearchTicks?.proseOk ?? false)
  const offerOk = propsTicks.offerOk || (liveResearchTicks?.offerOk ?? false)
  const rowOk = moneyOk && proseOk && offerOk

  const moneyHint =
    liveResearchTicks?.moneyHint ??
    (typeof verifiedSaving === 'number' && verifiedSaving > 0
      ? `verified_saving ≈ £${Math.round(verifiedSaving).toLocaleString('en-GB')}`
      : typeof savingAmountGbp === 'number' && savingAmountGbp > 0
        ? `saving_amount_gbp £${Math.round(savingAmountGbp).toLocaleString('en-GB')}`
        : propsTicks.moneyHint)

  if (!mounted || typeof document === 'undefined') return null
  if (suppressOverlay) return null

  const yellow = 'var(--color-yellow)'

  const panelInner =
    variant === 'likes' ? (
      <>
        <BulletRow ok={dbConnected} title="NEON (LONDON)" source="GET /api/health (public DB ping)" detail={dbHealthHint ?? undefined} />
        <BulletRow
          ok={apiDiagReady && apiGemini}
          title="GEMINI API"
          source="GET /api/health/diagnostics · server env"
          detail={
            !apiDiagReady
              ? 'Polling…'
              : apiGemini
                ? 'GEMINI_API_KEY set on this deployment.'
                : 'GEMINI_API_KEY unset — Zai / Gemini JSON paths will not run.'
          }
        />
        <BulletRow
          ok={apiDiagReady && apiFirecrawl}
          title="FIRECRAWL API"
          source="GET /api/health/diagnostics · server env"
          detail={
            !apiDiagReady
              ? 'Polling…'
              : apiFirecrawl
                ? 'FIRE_CRAWL_KEY_2 set on this deployment.'
                : 'Firecrawl key unset — Firecrawl scrape seeds will not run.'
          }
        />
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
          ok={apiDiagReady && apiGemini}
          title="GEMINI API"
          source="GET /api/health/diagnostics · server env"
          detail={
            !apiDiagReady
              ? 'Polling…'
              : apiGemini
                ? 'GEMINI_API_KEY set on this deployment (Vercel / local).'
                : 'GEMINI_API_KEY unset — research triplet, Zai, and discovery Gemini calls are disabled.'
          }
        />
        <BulletRow
          ok={apiDiagReady && apiFirecrawl}
          title="FIRECRAWL API"
          source="GET /api/health/diagnostics · server env"
          detail={
            !apiDiagReady
              ? 'Polling…'
              : apiFirecrawl
                ? 'FIRE_CRAWL_KEY_2 set on this deployment.'
                : 'Firecrawl key unset — Firecrawl-backed research will not run.'
          }
        />
        <BulletRow
          ok={apiDiagReady && apiAiGateway && apiAiGatewayOk}
          title="AI GATEWAY"
          source="Vercel AI Gateway · research + Zai failover"
          detail={
            !apiDiagReady
              ? 'Polling…'
              : !apiAiGateway
                ? 'AI gateway env unset — direct GEMINI_API_KEY only (AI_GATEWAY_API_KEY / AI_GATEWAY).'
                : apiAiGatewayOk
                  ? apiAiGatewayFallback
                    ? 'Switching to fallback — secondary model or direct Gemini active.'
                    : 'Gateway connected — primary model chain live.'
                  : apiAiGatewayDetail
                    ? `Gateway error — ${apiAiGatewayDetail}`
                    : 'Gateway configured but last pass failed — check Vercel AI Gateway dashboard.'
          }
        />
        <BulletRow
          ok={moneyOk}
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
    <motion.div className="pulse-diagnostic-anchor pointer-events-none z-[99] flex flex-col items-end gap-2">
      {open ? (
          <motion.div
            id="zz-intelligence-loop-panel"
            key="intel-loop-panel"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={INDUSTRIAL_OPACITY_SNAP}
            className={`pointer-events-auto pulse-diagnostic-panel pulse-diagnostic-panel--intel ${rowOk ? 'pulse-diagnostic-panel--research-live' : ''} relative flex w-[min(100vw-2rem,22rem)] min-h-[min(44dvh,380px)] max-h-[min(72dvh,520px)] flex-col overflow-y-auto`}
          >
            <motion.button
              type="button"
              aria-label="Close intelligence loop"
              onClick={close}
              className="pulse-panel-close-circle"
              transition={{ duration: 0.12 }}
            >
              <BackArrowDownLeft size={22} />
            </motion.button>

            <div className="pulse-diagnostic-panel__sheet flex min-h-0 min-w-0 flex-1 flex-col pr-14 text-left">
              <p className="pulse-diagnostic-label mb-2 shrink-0">INTELLIGENCE LOOP</p>
              <div className="pulse-diagnostic-body mt-auto flex min-w-0 flex-col">
                {panelInner}
              </div>
              {debugHudLine ? (
                <pre
                  data-testid="zone-debug-state"
                  className="m-0 mt-3 shrink-0 overflow-x-auto rounded-lg p-2 text-left"
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

      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls="zz-intelligence-loop-panel"
        aria-label={open ? 'Close intelligence loop' : 'Open intelligence loop'}
        onClick={() => setOpen((o) => !o)}
        className="pulse-triangle-fab pointer-events-auto"
        transition={INDUSTRIAL_OPACITY_SNAP}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ color: yellow }}>
          <path d="M12 3L22 20H2L12 3z" fill="currentColor" />
        </svg>
      </motion.button>
    </motion.div>
  )

  return createPortal(node, document.body)
}
