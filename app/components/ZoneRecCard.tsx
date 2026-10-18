'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import { ZoneBentoCardHeader } from '@/app/components/ui/ZoneBentoCardHeader'
import { zoneCardDomId } from '@/lib/zone/soloFocusReturn'
import { formatTypicalSaving, type RecCardCta, type RecCardModel } from '@/lib/zone/recCard'

type Props = {
  card: RecCardModel
  visited?: boolean
  /** Card body / primary `open` CTA. */
  onOpen: (card: RecCardModel) => void
  /** Any non-`open` CTA (connect bank, switch, confirm). */
  onCta?: (card: RecCardModel, cta: RecCardCta) => void
  /** Hero: the featured top-wins row. Same anatomy, larger type. */
  emphasis?: 'hero'
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-31" → "Jul 2026"; anything else is shown as given. */
function checkedLabel(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? '')
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : String(date ?? '')
}

/**
 * The one Zone recommendation card. Same blue bento shell as the wall tiles it replaces
 * (`bento-card-groovy` + `data-zone-surface="tip"`), laid out in the fixed slot order:
 * label · headline · typical saving (library cards) · whyYou · primaryCta · secondaryCta · badge.
 */
export function ZoneRecCard({ card, visited = false, onOpen, onCta, emphasis }: Props) {
  const typical = card.typicalSaving ? formatTypicalSaving(card.typicalSaving) : null
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
        emphasis === 'hero' ? 'zone-rec-card--hero' : '',
        visited ? 'zone-card--visited' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderRadius: 60, boxShadow: 'none' }}
      tabIndex={0}
      aria-label={`${card.label}: ${card.headline}.${typical ? ` ${typical.before}${typical.figure}${typical.after}.` : ''}${card.insight ? ` ${card.insight}` : ''} ${card.whyYou}`}
      onClick={onBodyClick}
      onKeyDown={onBodyKey}
    >
      <ZoneBentoCardHeader journeyId={card.category} label={card.label} />
      <h3 className="card-headline zone-rec-headline m-0 min-w-0" lang="en">
        {renderHeadline(card)}
      </h3>
      {card.typicalSaving ? (
        <>
          <p className="zone-rec-typical m-0" data-testid="rec-card-typical">
            {typical?.before}
            <span className="zone-rec-figure">{typical?.figure}</span>
            {typical?.after}
          </p>
          <p className="zone-rec-source m-0" data-testid="rec-card-source">
            Source: {card.typicalSaving.source.name}
            {card.typicalSaving.source.date ? `, checked ${checkedLabel(card.typicalSaving.source.date)}` : ''}
          </p>
        </>
      ) : null}
      {card.savingSource ? (
        <p className="zone-rec-source m-0" data-testid="rec-card-source">
          Source: {card.savingSource.name}
          {card.savingSource.date ? `, ${card.savingSource.date}` : ''}
        </p>
      ) : null}
      {card.insight ? (
        <p className="zone-rec-insight m-0" data-testid="rec-card-insight">
          {card.insight}
        </p>
      ) : null}
      <p className="zone-rec-why m-0">{card.whyYou}</p>
      <div className="zone-rec-actions">
        <button
          type="button"
          className={`zone-rec-cta${card.primaryCta.kind === 'done' ? ' zone-rec-cta--done' : ''}`}
          disabled={card.primaryCta.kind === 'done'}
          onClick={() => fire(card.primaryCta)}
        >
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
