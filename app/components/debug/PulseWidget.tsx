'use client'

/**
 * Mechanical diagnostic plugin — raw machine readout while Solo Focus is expanded.
 * Provenance from `PulseExpandedSync` (provider_name); `/api/health/diagnostics` for Neon / pipeline.
 * Hidden on `/settings`. System purple / yellow type (see `.pulse-diagnostic-panel`).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { usePulseExpandedDiagnostics } from '@/app/context/PulseExpandedDiagnosticsContext'
import {
  TRUTH_2026_MARCH,
  TRUTH_2026_JULY,
  PRICE_CAP_SOURCE_LABEL,
  PRICE_CAP_SOURCE_URL,
} from '@/lib/brains/constants'
import { formatZoneCardMoney } from '@/lib/format'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

const ROCK_HABIT_CATALOG_FIXED = 60

function showPulseWidget(): boolean {
  if (typeof process === 'undefined') return false
  if (process.env.NODE_ENV === 'development') return true
  if (process.env.NEXT_PUBLIC_PULSE_WIDGET === '1') return true
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return true
  return false
}

type DiagnosticsPayload = {
  neon?: boolean
  dbLatencyMs?: number | null
  researchProvenanceUrl?: string | null
  lastResearchScrapedAt?: string | null
  gemini?: boolean
  firecrawl?: boolean
  rockHabitCount?: number
}

/** Triangle FAB + diagnostic panel — lives in Solo Focus utility strip under close. */
export function PulseDiagnosticFab() {
  const cardMeta = usePulseExpandedDiagnostics()
  const [open, setOpen] = useState(false)
  const [neonOk, setNeonOk] = useState(false)
  const [dbLatencyMs, setDbLatencyMs] = useState<number | null>(null)
  const [researchProvenanceUrl, setResearchProvenanceUrl] = useState<string | null>(null)
  const [lastResearchScrapedAt, setLastResearchScrapedAt] = useState<string | null>(null)
  const [geminiOn, setGeminiOn] = useState(false)
  const [firecrawlOn, setFirecrawlOn] = useState(false)

  const pollDiagnostics = useCallback(async () => {
    const tReq = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const diagRes = await fetch('/api/health/diagnostics', { cache: 'no-store' })
      const tDone = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const rtt = Math.round(tDone - tReq)
      if (!diagRes.ok) {
        setNeonOk(false)
        setDbLatencyMs(null)
        setResearchProvenanceUrl(null)
        setLastResearchScrapedAt(null)
        setGeminiOn(false)
        setFirecrawlOn(false)
        return
      }
      const d = (await diagRes.json()) as DiagnosticsPayload
      setNeonOk(Boolean(d.neon))
      const serverMs = typeof d.dbLatencyMs === 'number' ? d.dbLatencyMs : null
      setDbLatencyMs(serverMs != null ? serverMs : rtt)
      const ru = d.researchProvenanceUrl?.trim()
      setResearchProvenanceUrl(ru && ru.startsWith('http') ? ru : null)
      const lr = d.lastResearchScrapedAt?.trim()
      setLastResearchScrapedAt(lr && lr.length > 0 ? lr : null)
      setGeminiOn(Boolean(d.gemini))
      setFirecrawlOn(Boolean(d.firecrawl))
    } catch {
      setNeonOk(false)
      setDbLatencyMs(null)
      setResearchProvenanceUrl(null)
      setLastResearchScrapedAt(null)
      setGeminiOn(false)
      setFirecrawlOn(false)
    }
  }, [])

  useEffect(() => {
    void pollDiagnostics()
    const id = setInterval(() => void pollDiagnostics(), 12_000)
    return () => clearInterval(id)
  }, [pollDiagnostics])

  useEffect(() => {
    if (!cardMeta) setOpen(false)
  }, [cardMeta])

  const capFigure = TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP

  const displaySourceUrl = useMemo(() => {
    const fromCard = cardMeta?.sourceUrl?.trim() ?? ''
    if (fromCard.startsWith('http')) return fromCard
    if (researchProvenanceUrl) return researchProvenanceUrl
    return PRICE_CAP_SOURCE_URL
  }, [cardMeta?.sourceUrl, researchProvenanceUrl])

  /** provider_name from expanded card metadata (Floating Nav / Solo Focus sync) */
  const displayProvider = useMemo(() => {
    const p = cardMeta?.providerName?.trim() ?? ''
    if (p && p !== '—') return p
    try {
      const h = new URL(displaySourceUrl).hostname.replace(/^www\./, '')
      return h || '—'
    } catch {
      return '—'
    }
  }, [cardMeta?.providerName, displaySourceUrl])

  const lastScrapeLabel = useMemo(() => {
    if (!lastResearchScrapedAt) return '—'
    try {
      const d = new Date(lastResearchScrapedAt)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return '—'
    }
  }, [lastResearchScrapedAt])

  const brainFeed = useMemo(
    () => [
      { key: 'brain', label: 'BRAIN', value: neonOk ? 'Connected (Neon SQL)' : 'Disconnected' },
      { key: 'latency', label: 'LATENCY', value: dbLatencyMs != null ? `${dbLatencyMs}ms` : '—' },
      { key: 'tips', label: 'ZONE_TIPS', value: 'POST /api/zone/tips-refresh' },
      { key: 'research', label: 'RESEARCH_INDEXED', value: lastScrapeLabel },
      {
        key: 'pipeline',
        label: 'GEMINI_FIRECRAWL',
        value: `${geminiOn ? 'on' : 'off'} · ${firecrawlOn ? 'on' : 'off'}`,
      },
      { key: 'rock', label: 'ROCK_HABITS', value: String(ROCK_HABIT_CATALOG_FIXED) },
    ],
    [neonOk, dbLatencyMs, lastScrapeLabel, geminiOn, firecrawlOn]
  )

  if (!showPulseWidget()) return null
  if (!cardMeta) return null

  const yellow = 'var(--color-yellow)'

  return (
    <motion.div className="pulse-diagnostic-anchor pulse-diagnostic-anchor--solo-focus pointer-events-none flex flex-col items-end gap-2">
      <>
        {open ? (
          <motion.div
            key="pulse-panel"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={INDUSTRIAL_OPACITY_SNAP}
            className="pointer-events-auto pulse-diagnostic-panel relative w-[min(100vw-2rem,22rem)]"
          >
              <motion.button
                type="button"
                aria-label="Close diagnostic panel"
                onClick={() => setOpen(false)}
                className="pulse-panel-close-circle"
                transition={INDUSTRIAL_OPACITY_SNAP}
              >
                <BackArrowDownLeft size={22} />
              </motion.button>

              <div className="flex flex-col w-full min-w-0 text-left pr-14 pt-0">
                <p className="pulse-diagnostic-label">PROVIDER_NAME</p>
                <p className="pulse-diagnostic-value">{displayProvider}</p>

                <p className="pulse-diagnostic-label">SOURCE_URL</p>
                <p className="pulse-diagnostic-value break-all">
                  <a
                    href={displaySourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: yellow }}
                  >
                    {displaySourceUrl}
                  </a>
                </p>

                <p className="pulse-diagnostic-label">REFERENCE</p>
                <p className="pulse-diagnostic-value">
                  Typical cap {formatZoneCardMoney(capFigure)}:{' '}
                  <a
                    href={PRICE_CAP_SOURCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: yellow }}
                  >
                    {PRICE_CAP_SOURCE_LABEL}
                  </a>
                </p>

                <p className="pulse-diagnostic-label mt-3">BRAIN_FEED</p>
                <div className="pulse-diagnostic-brain-grid">
                  {brainFeed.map((row) => (
                    <div key={row.key} className="pulse-diagnostic-brain-cell">
                      <p className="pulse-diagnostic-label">{row.label}</p>
                      <p className="pulse-diagnostic-value">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
          </motion.div>
        ) : null}
      </>

      <motion.button
        type="button"
        aria-expanded={open}
        aria-label="Open machine diagnostic"
        onClick={() => setOpen((o) => !o)}
        className="pulse-triangle-fab pointer-events-auto"
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={INDUSTRIAL_OPACITY_SNAP}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ color: yellow }}>
          <path d="M12 3L22 20H2L12 3z" fill="currentColor" />
        </svg>
      </motion.button>
    </motion.div>
  )
}
