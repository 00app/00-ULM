/**
 * Post-process validated Discovery / injection cards (urgency badges, etc.).
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'

/** Days before 1 April 2026 (UTC) when ECO4 / cap messaging gets a visible urgency strip. */
const APRIL_1_2026_UTC = Date.UTC(2026, 3, 1)

export function applyAprilEco4UrgencyBadge(
  card: ZoneTipCard,
  ctx: { journeyId: JourneyId; questionId: string; answerValue: string }
): ZoneTipCard {
  const days = Math.ceil((APRIL_1_2026_UTC - Date.now()) / 86400000)
  if (
    ctx.journeyId === 'home' &&
    ctx.questionId === 'energy_type' &&
    ctx.answerValue.trim().toUpperCase() === 'GAS' &&
    days > 0 &&
    days <= 10
  ) {
    return { ...card, badge: '10-DAY WINDOW' }
  }
  return card
}
