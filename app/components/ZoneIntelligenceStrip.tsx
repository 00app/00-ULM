'use client'

import type { ReactNode } from 'react'

/**
 * Fixed HUD: where Zone data comes from (Neon research row, local intelligence, scrape-sync).
 * Pointer-events none so it does not block taps on cards below.
 */

export type ZoneIntelligenceStripProps = {
  variant?: 'zone' | 'likes'
  dbConnected?: boolean
  /** True when `research_results.verified_saving` or `saving_amount_gbp` present (via scrape-sync). */
  neonVerifiedMoney?: boolean
  verifiedSaving?: number
  savingAmountGbp?: number
  localityLabel?: string
  gridGPerKwh?: number
  /** Right column — e.g. Sentinel line (same row as manifest HUD). */
  rightAside?: ReactNode
}

export function ZoneIntelligenceStrip({
  variant = 'zone',
  dbConnected = true,
  neonVerifiedMoney = false,
  verifiedSaving,
  savingAmountGbp,
  localityLabel,
  gridGPerKwh,
  rightAside,
}: ZoneIntelligenceStripProps) {
  if (variant === 'likes') {
    return (
      <div
        role="status"
        className="zone-intelligence-strip zone-intelligence-strip--likes"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 43,
          pointerEvents: 'none',
          padding: '8px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, transparent 0%, rgba(56, 0, 96, 0.94) 35%)',
          borderTop: '1px solid rgba(253, 253, 0, 0.12)',
        }}
      >
        <p
          className="m-0"
          style={{
            fontSize: 'clamp(9px, 2.6vw, 11px)',
            lineHeight: 1.45,
            color: 'var(--color-yellow)',
            fontFamily: 'var(--font-label)',
            opacity: 0.92,
            maxWidth: 'min(100%, 72ch)',
          }}
        >
          <strong style={{ fontFamily: 'var(--font-marvin)', letterSpacing: '0.02em' }}>LIKES · </strong>
          Saved card snapshots from your last Zone model. Open Zone for live Neon sync, scrape-sync, and{' '}
          <code style={{ fontSize: '0.95em', opacity: 0.85 }}>research_results</code> £ signals.
        </p>
      </div>
    )
  }

  const moneyBits: string[] = []
  if (typeof verifiedSaving === 'number' && Number.isFinite(verifiedSaving) && verifiedSaving > 0) {
    moneyBits.push(`verified_saving ≈ £${Math.round(verifiedSaving).toLocaleString('en-GB')}`)
  }
  if (typeof savingAmountGbp === 'number' && Number.isFinite(savingAmountGbp) && savingAmountGbp > 0) {
    moneyBits.push(`saving_amount_gbp £${Math.round(savingAmountGbp).toLocaleString('en-GB')}`)
  }
  const researchLine = neonVerifiedMoney
    ? `Neon row · ${moneyBits.join(' · ') || '£ fields present'}`
    : 'Neon research row · awaiting verified £ (GET /api/scrape-sync → research_results)'

  const localBits = [
    localityLabel ? `place: ${localityLabel}` : null,
    typeof gridGPerKwh === 'number' && Number.isFinite(gridGPerKwh)
      ? `grid ≈ ${Math.round(gridGPerKwh)} gCO₂/kWh`
      : null,
  ].filter(Boolean)

  return (
    <div
      role="status"
      aria-live="polite"
      className="zone-intelligence-strip"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 43,
        pointerEvents: 'none',
        padding: '8px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(180deg, transparent 0%, rgba(56, 0, 96, 0.94) 35%)',
        borderTop: '1px solid rgba(253, 253, 0, 0.12)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <p
          className="m-0"
          style={{
            fontSize: 'clamp(9px, 2.6vw, 11px)',
            lineHeight: 1.45,
            color: 'var(--color-yellow)',
            fontFamily: 'var(--font-label)',
            opacity: 0.93,
          }}
        >
          <strong style={{ fontFamily: 'var(--font-marvin)', letterSpacing: '0.03em', display: 'block', marginBottom: 2 }}>
            INTELLIGENCE LOOP
          </strong>
          <span style={{ opacity: 0.85 }}>DB · </span>
          {dbConnected ? 'Neon reachable' : 'Neon unreachable (hero may show RECALCULATING)'}
          <span style={{ opacity: 0.85 }}> · </span>
          {researchLine}
          <span style={{ opacity: 0.85 }}> · Local · </span>
          {localBits.length > 0 ? localBits.join(' · ') : 'POST /api/local-intelligence + Postcodes.io'}
        </p>
      </div>
      {rightAside ? (
        <div style={{ flex: '0 1 auto', textAlign: 'right', minWidth: 0 }}>{rightAside}</div>
      ) : null}
    </div>
  )
}
