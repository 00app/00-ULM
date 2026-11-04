'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import { BrandArrow } from '@/app/components/brand/BrandArrow'
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

/** CTA and badge copy arrives in capitals ("SEE HOW"); brand buttons are sentence case. */
function sentenceCase(s: string): string {
  const t = s.trim()
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-07-31" → "Jul 2026"; anything else is shown as given. */
function checkedLabel(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? '')
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : String(date ?? '')
}

/**
 * The one Zone recommendation card, in the brand language (docs/BRAND-LANGUAGE.md: white card,
 * hairline border, eyebrow, H4 headline, one stat with its source). Fixed slot order:
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
        'bento-card-groovy rock-bento-tile zone-rec-card zz-brand zzb-card',
        `zone-rec-card--${card.size}`,
        emphasis === 'hero' ? 'zone-rec-card--hero' : '',
        visited ? 'zone-card--visited' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      tabIndex={0}
      aria-label={`${card.label}: ${card.headline}.${typical ? ` ${typical.before}${typical.figure}${typical.after}.` : ''}${card.insight ? ` ${card.insight}` : ''} ${card.whyYou}`}
      onClick={onBodyClick}
      onKeyDown={onBodyKey}
    >
      <ZoneBentoCardHeader journeyId={card.category} label={card.label} />
      <h3 className="card-headline zone-rec-headline zzb-h4 m-0 min-w-0" lang="en">
        {renderHeadline(card)}
      </h3>
      {card.typicalSaving ? (
        <>
          <div className="zzb-card__metric">
            <p className="zone-rec-typical m-0" data-testid="rec-card-typical">
              <span className="zzb-card__value">{typical?.figure}</span>
              <span className="zzb-meta zone-rec-typical__phrase">
                {typical?.before.trim()}
                {typical?.after}
              </span>
            </p>
            <p className="zone-rec-source zzb-meta m-0" data-testid="rec-card-source">
              Source: {card.typicalSaving.source.name}
              {card.typicalSaving.source.date ? `, checked ${checkedLabel(card.typicalSaving.source.date)}` : ''}
            </p>
          </div>
        </>
      ) : null}
      {card.savingSource ? (
        <p className="zone-rec-source zzb-meta m-0" data-testid="rec-card-source">
          Source: {card.savingSource.name}
          {card.savingSource.date ? `, ${card.savingSource.date}` : ''}
        </p>
      ) : null}
      {card.insight ? (
        <p className="zone-rec-insight zzb-body m-0" data-testid="rec-card-insight">
          {card.insight}
        </p>
      ) : null}
      <p className="zone-rec-why zzb-meta m-0">{card.whyYou}</p>
      <div className="zone-rec-actions">
        <button
          type="button"
          className={`zone-rec-cta zzb-btn zzb-btn--sm ${card.primaryCta.kind === 'done' ? 'zzb-btn--outline zone-rec-cta--done' : 'zzb-btn--blue'}`}
          disabled={card.primaryCta.kind === 'done'}
          onClick={() => fire(card.primaryCta)}
        >
          {sentenceCase(card.primaryCta.label)}
          {card.primaryCta.kind === 'done' ? null : <BrandArrow />}
        </button>
        {card.secondaryCta ? (
          <button
            type="button"
            className="zone-rec-cta zone-rec-cta--secondary zzb-link"
            onClick={() => fire(card.secondaryCta as RecCardCta)}
          >
            {sentenceCase(card.secondaryCta.label)}
          </button>
        ) : null}
      </div>
      {card.badge ? (
        <span className="zone-rec-badge zzb-chip" data-testid="rec-card-badge">
          {sentenceCase(card.badge)}
        </span>
      ) : null}
    </article>
  )
}
