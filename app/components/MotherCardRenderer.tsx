'use client'

import React from 'react'
import { StampedCarbonKg, StampedMoneyGbp } from '@/app/components/StampedMetric'
import { IndustrialHandoffButton } from '@/app/components/ui/Buttons'

interface MotherCardRendererProps {
  categoryLabel: string
  headline: React.ReactNode
  narrative: React.ReactNode
  sourceFooter: string
  /** v35.0 — bottom citation after CTA: "Source: … — Verified …" */
  verifiedSourceCitation?: string | null
  /** When true, shows a “Verified data” chip above £ / kg (London DB-aligned figures). */
  verifiedDataBadge?: boolean
  actionLine?: string | null
  moneyGbp: number
  carbonKg: number
  impactPulse?: boolean
  ctaUrl?: string | null
  ctaJourneyId?: string
  ctaLabel?: string
  /** CTA handoff surface — yellow block for Action Vault high-impact rebirth. */
  ctaSurface?: 'pink' | 'yellow'
}

export function MotherCardRenderer({
  categoryLabel,
  headline,
  narrative,
  sourceFooter,
  verifiedSourceCitation = null,
  verifiedDataBadge = false,
  actionLine,
  moneyGbp,
  carbonKg,
  impactPulse = false,
  ctaUrl,
  ctaJourneyId,
  ctaLabel = 'CLAIM SAVING',
  ctaSurface = 'pink',
}: MotherCardRendererProps) {
  return (
    <>
      {headline}
      {categoryLabel ? (
        <h5
          className="solo-focus-category zz-label m-0 text-left"
          style={{ color: 'var(--journey-text)', fontSize: 'var(--zz-h4-mobile)', lineHeight: 0.8 }}
        >
          {categoryLabel}
        </h5>
      ) : null}
      {narrative}
      {verifiedSourceCitation?.trim() ? (
        <p
          className="solo-focus-verified-source solo-focus-supplied-by text-left w-full min-w-0 m-0"
          style={{ color: 'var(--journey-text)' }}
        >
          {verifiedSourceCitation.trim()}
        </p>
      ) : null}
      {sourceFooter.trim() ? (
      <p
        className="solo-focus-supplied-by headline-to-insight text-left w-full min-w-0 m-0"
        style={{ color: 'var(--journey-text)' }}
      >
        {sourceFooter}
      </p>
      ) : null}
      {actionLine?.trim() ? (
        <p
          className="solo-focus-action-line solo-focus-copy-width solo-focus-content-text text-left m-0"
          style={{ color: 'var(--journey-text)' }}
        >
          {actionLine.trim()}
        </p>
      ) : null}
      <div
        className={`solo-focus-impact-hero insight-to-impact card-impact-grid solo-focus-impact-grid grid grid-cols-2 gap-x-10 gap-y-0 w-full min-w-0${impactPulse ? ' solo-focus-impact-answer-pulse' : ''}`}
      >
        <div className="solo-focus-data-stack data-stack data-stack--tight">
          <span
            className="data-label inline-flex items-center gap-2 flex-wrap"
            style={{ color: 'var(--color-ink)' }}
          >
            Saving
            {verifiedDataBadge ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 zz-body-bold uppercase tracking-wide"
                style={{
                  fontSize: 'clamp(9px, 2.2vw, 11px)',
                  fontFamily: 'var(--font-label)',
                  background: 'color-mix(in srgb, var(--color-yellow) 38%, transparent)',
                  color: 'var(--color-ink)',
                  border: '1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)',
                }}
                aria-label="True data — a Neon research_results row exists for this category"
              >
                ✓ True data
              </span>
            ) : null}
          </span>
          <span className="data-value solo-focus-data-value data-stamp-metric" style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            <StampedMoneyGbp gbp={moneyGbp} />
          </span>
        </div>
        <div className="solo-focus-data-stack data-stack data-stack--tight data-stack--secondary solo-focus-carbon-stack">
          <span className="data-label" style={{ color: 'var(--color-ink)' }}>
            Carbon Offset
          </span>
          <span className="data-value solo-focus-data-value data-stamp-metric" style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            <StampedCarbonKg kg={carbonKg} />
          </span>
        </div>
      </div>
      {ctaUrl ? (
        <div className="solo-focus-trinity impact-to-trinity flex flex-row items-center justify-start flex-shrink-0 w-full" style={{ gap: 20, marginTop: 0, marginBottom: 0 }}>
          <IndustrialHandoffButton
            url={ctaUrl}
            journeyId={ctaJourneyId}
            moneyValue={moneyGbp}
            ctaLabel={ctaLabel}
            surface={ctaSurface === 'yellow' ? 'yellow' : 'pink'}
          />
        </div>
      ) : null}
    </>
  )
}
