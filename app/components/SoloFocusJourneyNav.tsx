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
  className?: string
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
  className = '',
}: SoloFocusJourneyNavProps) {
  const useWallRing = Boolean(navRing?.length && currentCardId && onNavigateEntry)
  const wallNeighbors = useWallRing
    ? soloFocusNavNeighbors(currentCardId!, navRing!)
    : null
  const journeyNeighbors = soloFocusJourneyNeighbors(journeyId, availableJourneyIds)
  const prevLabel = wallNeighbors?.prevLabel ?? journeyNeighbors.prevLabel
  const nextLabel = wallNeighbors?.nextLabel ?? journeyNeighbors.nextLabel
  const isInset = className.includes('solo-focus-journey-nav--inset')

  return (
    <nav
      className={`solo-focus-journey-nav${isInset ? '' : ' solo-focus-nav-container'} ${className}`.trim()}
      aria-label="Journey navigation"
    >
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
        aria-label={`Previous: ${prevLabel}`}
      >
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--prev" />
        <h4 className="solo-focus-journey-nav__label nav-label">{prevLabel}</h4>
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
        aria-label={`Next: ${nextLabel}`}
      >
        <h4 className="solo-focus-journey-nav__label nav-label">{nextLabel}</h4>
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--next" />
      </button>
    </nav>
  )
}
