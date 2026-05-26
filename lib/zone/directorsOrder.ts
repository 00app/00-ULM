/**
 * Director's Order — rigid Zone card lifecycle (brains / UX contract).
 * Motion is skin only; these guards are the skeleton.
 *
 * Loop 1 (mother / category bento): close → one loop question → birth discovery → mother pink.
 * Loop 2 (discovery inject): open Solo Focus → close → pink immediately, no second loop.
 *
 * @see docs/HANDBOOK.md — Launch verification + Director's Order
 */

import type { JourneyId } from '@/lib/journeys'
import { hasLoopDoneForJourney } from '@/lib/zone/loopMemory'
import { isCardVisited, shouldSkipInjectionOnCardClose } from '@/lib/zone/visitedCards'

/** Client-birthed discovery / achievement cells (`inject-*`, not sentinel/fallback). */
export function isDiscoveryInjectCard(cardId: string | null | undefined): boolean {
  const id = cardId?.trim()
  if (!id || !id.startsWith('inject-')) return false
  if (id.startsWith('inject-sentinel-') || id.startsWith('inject-fallback-')) return false
  return true
}

/**
 * Close returns straight to grid and marks pink — no loop takeover.
 * Discovery injects always; mother/rock when already visited or loop done for journey.
 */
export function shouldCloseMarkPinkOnly(
  cardId: string | null | undefined,
  journeyId?: JourneyId | string | null
): boolean {
  if (isDiscoveryInjectCard(cardId)) return true
  return shouldSkipInjectionOnCardClose(cardId, journeyId)
}

/** Post-close loop takeover: at most one beat per journey; never for discovery injects. */
export function shouldOpenLoopTakeover(
  cardId: string | null | undefined,
  journeyId: JourneyId
): boolean {
  if (isDiscoveryInjectCard(cardId)) return false
  if (hasLoopDoneForJourney(journeyId)) return false
  if (shouldSkipInjectionOnCardClose(cardId, journeyId)) return false
  return true
}

/** Rock rail / explicit visited close — no loop question. */
export function shouldCloseToGridOnly(visitedClose?: boolean): boolean {
  return visitedClose === true
}

/** Pink = opened at least once (per card id for discovery; journey fallback for mother only). */
export function isZoneCardPink(
  cardId: string,
  visitedCardIds: ReadonlySet<string>,
  dbVisitedJourneyKeys: ReadonlySet<string>,
  journeyKey?: JourneyId | string | null
): boolean {
  const id = cardId.trim()
  if (!id) return false
  if (id.startsWith('rock-')) return visitedCardIds.has(id)
  if (isDiscoveryInjectCard(id)) return visitedCardIds.has(id)
  if (visitedCardIds.has(id)) return true
  const jid = typeof journeyKey === 'string' ? journeyKey.trim() : ''
  return jid.length > 0 && dbVisitedJourneyKeys.has(jid)
}
