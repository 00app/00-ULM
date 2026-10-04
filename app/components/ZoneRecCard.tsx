'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { zoneCardDomId } from '@/lib/zone/soloFocusReturn'
import type { RecCardCta, RecCardModel } from '@/lib/zone/recCard'

type Props = {
  card: RecCardModel
  visited?: boolean
  /** Card body / primary `open` CTA. */
  onOpen: (card: RecCardModel) => void
  /** Any non-`open` CTA (connect bank, switch, confirm). */
  onCta?: (card: RecCardModel, cta: RecCardCta) => void
}

/** Splits "Save £420 a year" so the £ figure alone can take the display face. */
function renderHeadline(card: RecCardModel) {
  if (card.savingGbpPerYear == null) return card.headline
  const m = card.headline.match(/^(.*?)(£[\d,]+)(.*)$/)
  if (!m) return card.headline
  return (
    <>
      {m[1]}
      <span className="zone-rec-figure">{m[2]}</span>
      {m[3]}
    </>
  )
}

/**
 * The one Zone recommendation card. Same blue bento shell as the wall tiles it replaces
 * (`bento-card-groovy` + `data-zone-surface="tip"`), laid out in the fixed slot order:
 * label · headline · whyYou · primaryCta · secondaryCta · badge.
 */
export function ZoneRecCard({ card, visited = false, onOpen, onCta }: Props) {
  const fire = (cta: RecCardCta) => {
    if (cta.kind === 'open') onOpen(card)
    else onCta?.(card, cta)
  }
  const onBodyClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    onOpen(card)
  }
  const onBodyKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(card)
    }
  }
  return (
    <article
      id={zoneCardDomId(card.id)}
      data-zone-surface="tip"
      data-rec-card={card.id}
      data-rec-size={card.size}
      className={[
        'bento-card-groovy rock-bento-tile zone-rec-card',
        `zone-rec-card--${card.size}`,
        visited ? 'zone-card--visited' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderRadius: 60, boxShadow: 'none' }}
      tabIndex={0}
      aria-label={`${card.label}: ${card.headline}. ${card.whyYou}`}
      onClick={onBodyClick}
      onKeyDown={onBodyKey}
    >
      <ZoneBentoCardHeader journeyId={card.category} label={card.label} />
      <h3 className="card-headline zone-rec-headline m-0 min-w-0" lang="en">
        {renderHeadline(card)}
      </h3>
      {card.savingSource ? (
        <p className="zone-rec-source m-0" data-testid="rec-card-source">
          Source: {card.savingSource.name}
          {card.savingSource.date ? `, ${card.savingSource.date}` : ''}
        </p>
      ) : null}
      <p className="zone-rec-why m-0">{card.whyYou}</p>
      <div className="zone-rec-actions">
        <button type="button" className="zone-rec-cta" onClick={() => fire(card.primaryCta)}>
          {card.primaryCta.label}
        </button>
        {card.secondaryCta ? (
          <button
            type="button"
            className="zone-rec-cta zone-rec-cta--secondary"
            onClick={() => fire(card.secondaryCta as RecCardCta)}
          >
            {card.secondaryCta.label}
          </button>
        ) : null}
      </div>
      {card.badge ? (
        <span className="zone-rec-badge" data-testid="rec-card-badge">
          {card.badge}
        </span>
      ) : null}
    </article>
  )
}
