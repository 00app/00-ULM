'use client'

import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { soloFocusJourneyNeighbors } from '@/lib/zone/soloFocusJourneyNav'
import type { JourneyId } from '@/lib/journeys'

export type SoloFocusJourneyNavProps = {
  journeyId: JourneyId
  onNavigate: (target: JourneyId) => void
  className?: string
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
}

export function SoloFocusJourneyNav({ journeyId, onNavigate, className = '' }: SoloFocusJourneyNavProps) {
  const { prev, next, prevLabel, nextLabel } = soloFocusJourneyNeighbors(journeyId)

  return (
    <nav
      className={`solo-focus-journey-nav solo-focus-pager-rail--fixed ${className}`.trim()}
      aria-label="Journey navigation"
    >
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--prev"
        onClick={() => {
          triggerHaptic()
          onNavigate(prev)
        }}
        aria-label={`Previous: ${prevLabel}`}
      >
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--prev" />
        <h4 className="solo-focus-journey-nav__label">{prevLabel}</h4>
      </button>
      <button
        type="button"
        className="solo-focus-journey-nav__btn solo-focus-journey-nav__btn--next"
        onClick={() => {
          triggerHaptic()
          onNavigate(next)
        }}
        aria-label={`Next: ${nextLabel}`}
      >
        <h4 className="solo-focus-journey-nav__label">{nextLabel}</h4>
        <BackArrowDownLeft size={18} className="solo-focus-journey-nav__arrow solo-focus-journey-nav__arrow--next" />
      </button>
    </nav>
  )
}
