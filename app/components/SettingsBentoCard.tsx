'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowNEOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { isCardVisited, markCardVisited } from '@/lib/zone/visitedCards'

/** Light-blue until opened, white once visited — same rollover as Zone bento cards (v2). */
export function useSettingsCardVisited(cardId: string | undefined): [boolean, () => void] {
  const [visited, setVisited] = useState(() => (cardId ? isCardVisited(cardId) : false))
  useEffect(() => {
    if (!cardId) return
    setVisited(isCardVisited(cardId))
    const sync = () => setVisited(isCardVisited(cardId))
    window.addEventListener('zz-visited-cards-changed', sync)
    return () => window.removeEventListener('zz-visited-cards-changed', sync)
  }, [cardId])
  const markVisited = () => {
    if (cardId) markCardVisited(cardId)
  }
  return [visited, markVisited]
}

function PencilIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

export default function SettingsBentoCard({
  label,
  headline,
  editHref,
  onEditClick,
  externalHref,
  externalLabel,
  children,
  isHero = false,
  hideLabel = false,
  cardId,
}: {
  label: string
  headline: string
  editHref?: string
  onEditClick?: () => void
  externalHref?: string
  externalLabel?: string
  children?: ReactNode
  isHero?: boolean
  /** Preview tiles — headline + arrow only (no card-top-label). */
  hideLabel?: boolean
  /** Deep blue until this card is opened, pink once visited (skip on isHero — Overview stays pink). */
  cardId?: string
}) {
  const [, markVisited] = useSettingsCardVisited(isHero ? undefined : cardId)
  // Cool until pressed: every settings card is a white surface with blue ink on the elev-1 glow
  // and fills blue on press. Colour lives in the V2 settings block in globals.css, not inline, so
  // there is one place to change it and no inline style can put blue text back on a blue card.

  const arrowSlot = () => {
    if (onEditClick) {
      return (
        <button
          type="button"
          onClick={() => {
            markVisited()
            onEditClick()
          }}
          className="card-top-arrow card-top-arrow--action flex items-center justify-center flex-shrink-0"
          aria-label={`Edit: ${label}`}
        >
          <PencilIcon />
        </button>
      )
    }
    if (editHref) {
      return (
        <Link
          href={editHref}
          onClick={markVisited}
          className="card-top-arrow card-top-arrow--action flex items-center justify-center flex-shrink-0"
          aria-label={`Edit: ${label}`}
        >
          <PencilIcon />
        </Link>
      )
    }
    if (externalHref) {
      return (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markVisited}
          className="card-top-arrow card-top-arrow--action flex items-center justify-center flex-shrink-0"
          aria-label={externalLabel ?? `Open: ${label}`}
        >
          <ArrowNEOutlineIcon size={18} />
        </a>
      )
    }
    return <span className="settings-card-arrow-spacer" aria-hidden />
  }

  return (
    <div
      className={`bento-card-groovy settings-bento-card settings-card-bento flex flex-col justify-between w-full h-full${isHero ? ' settings-hero-card settings-bento-card--info' : ''}${hideLabel ? ' settings-bento-card--headline-only' : ''}`.trim()}
    >
      {hideLabel ? (
        <div className="settings-headline-only-row flex items-start justify-between gap-2 w-full shrink-0">
          <div className="settings-journey-answers flex-1 min-w-0">
            <SettingsJourneyFactRow label={label} value={headline} />
          </div>
          {arrowSlot()}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between w-full shrink-0">
            <span className="card-top-label">
              {label}
            </span>
            {arrowSlot()}
          </div>
          <h3 className="card-headline m-0">
            {headline}
          </h3>
        </>
      )}
      {children}
    </div>
  )
}

export function SettingsJourneyFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-journey-answer-row">
      <h4 className="settings-journey-q zz-h4">{label}</h4>
      <h3 className="settings-journey-a zz-h3 m-0">{value}</h3>
    </div>
  )
}

export function SettingsJourneyCardShell({
  label,
  children,
  externalHref,
  externalLabel,
}: {
  label: string
  children: ReactNode
  externalHref?: string
  externalLabel?: string
}) {
  return (
    <div
      className="bento-card-groovy settings-bento-card settings-card-bento settings-journey-card-shell flex flex-col justify-between w-full h-full"
    >
      <div className="flex items-center justify-between w-full shrink-0 mb-2">
        <span className="card-top-label">
          {label}
        </span>
        {externalHref ? (
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="card-top-arrow card-top-arrow--action flex items-center justify-center flex-shrink-0"
            aria-label={externalLabel ?? `Open: ${label}`}
          >
            <ArrowNEOutlineIcon size={18} />
          </a>
        ) : (
          <span className="settings-card-arrow-spacer" aria-hidden />
        )}
      </div>
      <div className="flex flex-col gap-2 settings-journey-answers">{children}</div>
    </div>
  )
}
