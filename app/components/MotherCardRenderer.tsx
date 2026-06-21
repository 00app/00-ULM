'use client'

import React from 'react'
import { StampedCarbonKg, StampedMoneyGbp } from '@/app/components/StampedMetric'
import { SoloFocusActionTrinity } from '@/app/components/SoloFocusActionTrinity'

interface MotherCardRendererProps {
  categoryLabel: string
  headline: React.ReactNode
  narrative: React.ReactNode
  sourceFooter: string
  /** v35.0 — bottom citation after CTA: "Source: … — Verified …" */
  verifiedSourceCitation?: string | null
  actionLine?: string | null
  moneyGbp: number
  carbonKg: number
  impactPulse?: boolean
  ctaUrl?: string | null
  ctaJourneyId?: string
  ctaLabel?: string
  /** Company / publisher behind the handoff URL — shown below CTA as h3. */
  offerProviderName?: string | null
  /** CTA handoff surface — yellow block for Action Vault high-impact rebirth. */
  ctaSurface?: 'pink' | 'yellow'
  isLiked?: boolean
  onLike?: () => void
  onAskZai?: () => void
}

export function MotherCardRenderer({
  categoryLabel,
  headline,
  narrative,
  sourceFooter,
  verifiedSourceCitation = null,
  actionLine,
  moneyGbp,
  carbonKg,
  impactPulse = false,
  ctaUrl,
  ctaJourneyId,
  ctaLabel = 'CLAIM',
  offerProviderName,
  ctaSurface = 'pink',
  isLiked = false,
  onLike,
  onAskZai,
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
          <span className="data-label" style={{ color: 'var(--color-ink)' }}>
            Saving
          </span>
          <span className="data-value solo-focus-data-value data-stamp-metric" style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            <StampedMoneyGbp gbp={moneyGbp} />
          </span>
        </div>
        <div className="solo-focus-data-stack data-stack data-stack--tight data-stack--secondary solo-focus-carbon-stack">
          <span className="data-label" style={{ color: 'var(--color-ink)' }}>
            CO<span className="data-co2-sub">2</span> OFFSET
          </span>
          <span className="data-value solo-focus-data-value data-stamp-metric" style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            <StampedCarbonKg kg={carbonKg} omitCo2Suffix />
          </span>
        </div>
      </div>
      {(ctaUrl || onLike || onAskZai) ? (
        <SoloFocusActionTrinity
          ctaUrl={ctaUrl}
          ctaLabel={ctaLabel}
          journeyId={ctaJourneyId}
          moneyGbp={moneyGbp}
          ctaSurface={ctaSurface}
          isLiked={isLiked}
          showLike={Boolean(onLike)}
          showAskZai={Boolean(onAskZai)}
          onLike={onLike}
          onAskZai={onAskZai}
        />
      ) : null}
      {ctaUrl && offerProviderName?.trim() ? (
        <h3
          className="solo-focus-offer-provider zz-h3 text-marvin trinity-to-offer-provider m-0 text-left w-full min-w-0"
          style={{ color: 'var(--journey-text)' }}
        >
          {offerProviderName.trim()}
        </h3>
      ) : null}
    </>
  )
}
