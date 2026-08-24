'use client'

import React from 'react'
import { StampedCarbonKg, StampedMoneyGbp } from '@/app/components/StampedMetric'
import { SoloFocusActionTrinity } from '@/app/components/SoloFocusActionTrinity'

interface MotherCardRendererProps {
  categoryLabel: string
  headline: React.ReactNode
  narrative: React.ReactNode
  sourceFooter: string
  actionLine?: string | null
  moneyGbp: number
  carbonKg: number
  /** True when this journey has no real answers yet and the figures below are a mid-band guess
      from the profile baseline, not the user's own answers — must say so, never assert a number
      silently as if it were verified. */
  estimated?: boolean
  impactPulse?: boolean
  ctaUrl?: string | null
  ctaJourneyId?: string
  ctaLabel?: string
  /** CTA handoff surface — yellow block for Action Vault high-impact rebirth. */
  ctaSurface?: 'pink' | 'yellow'
  isLiked?: boolean
  isDisliked?: boolean
  onLike?: () => void
  onAskZai?: () => void
  onDislike?: () => void
  onCtaClick?: () => void
}

export function MotherCardRenderer({
  categoryLabel,
  headline,
  narrative,
  sourceFooter,
  actionLine,
  moneyGbp,
  carbonKg,
  estimated = false,
  impactPulse = false,
  ctaUrl,
  ctaJourneyId,
  ctaLabel = 'CLAIM',
  ctaSurface = 'pink',
  isLiked = false,
  isDisliked = false,
  onLike,
  onAskZai,
  onDislike,
  onCtaClick,
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
            Saving{estimated ? ' (estimated)' : ''}
          </span>
          <span className="data-value solo-focus-data-value data-stamp-metric" style={{ color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
            <StampedMoneyGbp gbp={moneyGbp} />
          </span>
        </div>
        <div className="solo-focus-data-stack data-stack data-stack--tight data-stack--secondary solo-focus-carbon-stack">
          <span className="data-label" style={{ color: 'var(--color-ink)' }}>
            {/* "Offset" implies paying someone else to compensate — this app only ever shows
                CO2 avoided by the user's own behaviour change, never a purchased offset. */}
            CO<span className="data-co2-sub">2</span> Saving{estimated ? ' (estimated)' : ''}
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
          isDisliked={isDisliked}
          showLike={Boolean(onLike)}
          showAskZai={Boolean(onAskZai)}
          showDislike={Boolean(onDislike)}
          onLike={onLike}
          onAskZai={onAskZai}
          onDislike={onDislike}
          onCtaClick={onCtaClick}
        />
      ) : null}
    </>
  )
}
