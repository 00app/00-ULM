/**
 * Director's Order — rigid Zone sequence (brains / UX contract).
 * Motion is skin only; these guards are the skeleton.
 *
 * @see docs/HANDBOOK.md — Launch verification + Director's Order
 */

import type { JourneyId } from '@/lib/journeys'
import { hasLoopDoneForJourney } from '@/lib/zone/loopMemory'
import { shouldSkipInjectionOnCardClose } from '@/lib/zone/visitedCards'

/** Post-close loop takeover: at most one beat per journey; never when pink or loop already done. */
export function shouldOpenLoopTakeover(
  cardId: string | null | undefined,
  journeyId: JourneyId
): boolean {
  if (hasLoopDoneForJourney(journeyId)) return false
  if (shouldSkipInjectionOnCardClose(cardId, journeyId)) return false
  return true
}

/** Rock rail / explicit visited close — no loop question. */
export function shouldCloseToGridOnly(visitedClose?: boolean): boolean {
  return visitedClose === true
}
