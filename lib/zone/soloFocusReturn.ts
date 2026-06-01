import type { JourneyId } from '@/lib/journeys'

/** Where Solo Focus was opened from — used to scroll back on close. */
export type SoloFocusReturnTarget = {
  cardId: string
  journeyKey?: JourneyId
  surface: 'journey' | 'grid-tip' | 'rock' | 'discovery'
}

const RETURN_SCROLL_DELAY_MS = 450

export function zoneCardDomId(cardId: string): string {
  return `zone-card-${cardId}`
}

export function zoneJourneyDomId(journeyKey: JourneyId | string): string {
  return `zone-journey-${journeyKey}`
}

/** Smooth scroll to the bento / rock tile that opened Solo Focus. */
export function scrollToSoloFocusReturn(target: SoloFocusReturnTarget | null | undefined): void {
  if (!target || typeof document === 'undefined') return

  const run = () => {
    if (target.surface === 'journey' && target.journeyKey) {
      document.getElementById(zoneJourneyDomId(target.journeyKey))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    const cardEl = document.getElementById(zoneCardDomId(target.cardId))
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (target.surface === 'rock') {
      document.querySelector('.zone-rock-strip')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(run, RETURN_SCROLL_DELAY_MS)
  })
}
