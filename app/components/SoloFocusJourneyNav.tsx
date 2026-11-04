'use client'

import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { BrandArrow } from '@/app/components/brand/BrandArrow'
import {
  soloFocusJourneyNeighbors,
  soloFocusNavNeighbors,
  type SoloFocusNavEntry,
} from '@/lib/zone/soloFocusJourneyNav'
import type { JourneyId } from '@/lib/journeys'

export type SoloFocusJourneyNavProps = {
  journeyId: JourneyId
  onNavigate: (target: JourneyId) => void
  /** Wall-order ring — prev/next walk mother + discovery tip cells. */
  navRing?: readonly SoloFocusNavEntry[]
  currentCardId?: string | null
  onNavigateEntry?: (entry: SoloFocusNavEntry) => void
  /** @deprecated Prefer `navRing` — journey-only fallback when ring omitted. */
  availableJourneyIds?: readonly JourneyId[]
  /** Unvisited destination cells show + on the nav label. */
  isUnreadCard?: (cardId: string) => boolean
  className?: string
  /** Brand-language links ("← Home", "Utilities →") inside a .zz-brand surface. */
  brand?: boolean
}

/** Wall labels arrive in capitals ("UTILITIES"); brand links are sentence case. */
function sentenceCaseNavLabel(label: string): string {
  const t = label.trim()
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t
}

function NavDestinationLabel({
  label,
  kind,
  cardId,
  isUnreadCard,
}: {
  label: string
  kind: 'journey' | 'tip'
  cardId: string
  isUnreadCard?: (cardId: string) => boolean
}) {
  const isNew = isUnreadCard?.(cardId) ?? false
  return (
    <h4 className={`solo-focus-journey-nav__label nav-label zz-label solo-focus-journey-nav__label--${kind}`}>
      {label}
      {isNew ? (
        <span className="solo-focus-new-badge" aria-hidden>
          +
        </span>
      ) : null}
    </h4>
  )
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
}

export function SoloFocusJourneyNav({
  journeyId,
  onNavigate,
  navRing,
  currentCardId,
  onNavigateEntry,
  availableJourneyIds,
  isUnreadCard,
  className = '',
  brand = false,
}: SoloFocusJourneyNavProps) {
  const resolvedCardId = (currentCardId?.trim() || `journey-${journeyId}`).trim()
  const useWallRing = Boolean(navRing?.length && onNavigateEntry)
  const wallNeighbors = useWallRing
    ? soloFocusNavNeighbors(resolvedCardId, navRing!, journeyId)
    : null
  const journeyNeighbors = soloFocusJourneyNeighbors(journeyId, availableJourneyIds)
  const prevLabel = wallNeighbors?.prevLabel ?? journeyNeighbors.prevLabel
  const nextLabel = wallNeighbors?.nextLabel ?? journeyNeighbors.nextLabel
  const prevLabelKind = wallNeighbors?.prev.kind ?? 'journey'
  const nextLabelKind = wallNeighbors?.next.kind ?? 'journey'
  const isInset = className.includes('solo-focus-journey-nav--inset')

  const goPrev = () => {
    triggerHaptic()
    if (wallNeighbors && onNavigateEntry) {
      onNavigateEntry(wallNeighbors.prev)
      return
    }
    onNavigate(journeyNeighbors.prev)
  }
  const goNext = () => {
    triggerHaptic()
    if (wallNeighbors && onNavigateEntry) {
      onNavigateEntry(wallNeighbors.next)
      return
    }
    onNavigate(journeyNeighbors.next)
  }

  if (brand) {
    const prevNew = wallNeighbors ? (isUnreadCard?.(wallNeighbors.prev.cardId) ?? false) : false
    const nextNew = wallNeighbors ? (isUnreadCard?.(wallNeighbors.next.cardId) ?? false) : false
    return (
      <nav className={`solo-focus-journey-nav solo-focus-journey-nav--brand ${className}`.trim()} aria-label="Journey navigation">
        <button type="button" className="zzb-link" onClick={goPrev} aria-label={`Previous wall card: ${prevLabel}`}>
          <BrandArrow back />
          {sentenceCaseNavLabel(prevLabel)}
          {prevNew ? <span className="zzb-new-dot" aria-hidden /> : null}
        </button>
        <button type="button" className="zzb-link" onClick={goNext} aria-label={`Next wall card: ${nextLabel}`}>
          {sentenceCaseNavLabel(nextLabel)}
          {nextNew ? <span className="zzb-new-dot" aria-hidden /> : null}
          <BrandArrow />
        </button>
      </nav>
    )
  }

  return (
    <nav
      className={`solo-focus-journey-nav${isInset ? '' : ' solo-focus-nav-container'} ${className}`.trim()}
      aria-label="Journey navigation"
    >
      {/* Left = earlier in wall ring (advanceNavRingIndex −1). Right = next cell (+1). */}
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--prev"
        onClick={goPrev}
        aria-label={`Previous wall card: ${prevLabel}`}
      >
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--prev" />
        {wallNeighbors ? (
          <NavDestinationLabel
            label={prevLabel}
            kind={prevLabelKind}
            cardId={wallNeighbors.prev.cardId}
            isUnreadCard={isUnreadCard}
          />
        ) : (
          <h4 className={`solo-focus-journey-nav__label nav-label zz-label solo-focus-journey-nav__label--${prevLabelKind}`}>
            {prevLabel}
          </h4>
        )}
      </button>
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--next"
        onClick={goNext}
        aria-label={`Next wall card: ${nextLabel}`}
      >
        {wallNeighbors ? (
          <NavDestinationLabel
            label={nextLabel}
            kind={nextLabelKind}
            cardId={wallNeighbors.next.cardId}
            isUnreadCard={isUnreadCard}
          />
        ) : (
          <h4 className={`solo-focus-journey-nav__label nav-label zz-label solo-focus-journey-nav__label--${nextLabelKind}`}>
            {nextLabel}
          </h4>
        )}
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--next" />
      </button>
    </nav>
  )
}
