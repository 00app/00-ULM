'use client'

import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
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
    <h4 className={`solo-focus-journey-nav__label nav-label solo-focus-journey-nav__label--${kind}`}>
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

  return (
    <nav
      className={`solo-focus-journey-nav${isInset ? '' : ' solo-focus-nav-container'} ${className}`.trim()}
      aria-label="Journey navigation"
    >
      {/* Left = earlier in wall ring (advanceNavRingIndex −1). Right = next cell (+1). */}
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--prev"
        onClick={() => {
          triggerHaptic()
          if (wallNeighbors && onNavigateEntry) {
            onNavigateEntry(wallNeighbors.prev)
            return
          }
          onNavigate(journeyNeighbors.prev)
        }}
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
          <h4 className={`solo-focus-journey-nav__label nav-label solo-focus-journey-nav__label--${prevLabelKind}`}>
            {prevLabel}
          </h4>
        )}
      </button>
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--next"
        onClick={() => {
          triggerHaptic()
          if (wallNeighbors && onNavigateEntry) {
            onNavigateEntry(wallNeighbors.next)
            return
          }
          onNavigate(journeyNeighbors.next)
        }}
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
          <h4 className={`solo-focus-journey-nav__label nav-label solo-focus-journey-nav__label--${nextLabelKind}`}>
            {nextLabel}
          </h4>
        )}
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--next" />
      </button>
    </nav>
  )
}
