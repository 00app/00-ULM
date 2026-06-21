/**
 * Director's Order — rigid Zone card lifecycle (brains / UX contract).
 * Motion is skin only; these guards are the skeleton.
 *
 * Loop 1 (mother / category bento): close → one loop question → birth discovery → mother pink.
 * Loop 2 (discovery inject): open Solo Focus → close → pink immediately, no second loop.
 *
 * ## Solo Focus UI contract (mother stack — no duplication)
 *
 * | Slot | Source | Rule |
 * |------|--------|------|
 * | Label | `formatZoneCategoryLabel(journeyId)` | UPPERCASE journey key, journey yellow |
 * | H1 | `headlineFromExpandedHook` + `EXPANDED_JOURNEY_HOOK` | 20–24 words; no generic spring filler |
 * | Lead | `SoloFocusProseStack` H4 | Locality via `locationName` — town, not postcode; ≤30 words |
 * | Body | — | **Lead-only UI** (May 2026) — no Roboto architect body; SAVE/CARBON metrics row owns £/kg |
 * | Discovery inject | overlay | Same lead-only stack — no no-offer footer |
 * | Rock tips | `ZoneBentoCardHeader` | Label ink = headline ink at rest + hover (`--journey-text`) |
 * | Impact | `MotherCardRenderer` SAVE/CARBON | Single stamp — hide `payoffSentence` text when prose already has £ |
 * | Trinity | Ask Zai · Like · BUY/CLAIM | `SoloFocusActionTrinity` / industrial handoff |
 * | Nav | `soloFocusNavRingFromDisplayItems` | Wall order — left prev / right next; mothers UPPERCASE; tips title fragment (`soloFocusNavLabels.ts`) |
 *
 * ## Layout (single column — all breakpoints)
 *
 * Label → H1 → lead (+ optional body) → SAVE/CARBON → Trinity → prev/next nav.
 * H1→lead gap: 10px. All other stack gaps: 40px.
 * Content max-width: 100% mobile · 640px tablet (768+) · 880px desktop (1024+), centred.
 * Close: viewport-locked pink X — same as Likes / Zai / Settings (`.zz-back-btn--viewport-lock`).
 *
 * @see docs/HANDBOOK.md — Launch verification + Director's Order
 */

import type { JourneyId } from '@/lib/journeys'
import { hasLoopDoneForJourney } from '@/lib/zone/loopMemory'
import { MAX_SOLO_FOCUS_PROSE_BLOCKS } from '@/lib/zone/zoneVoice'
import { isCardVisited, shouldSkipInjectionOnCardClose } from '@/lib/zone/visitedCards'

export const SOLO_FOCUS_UI_CONTRACT = {
  maxProseBlocks: MAX_SOLO_FOCUS_PROSE_BLOCKS,
  headlineWordsMin: 20,
  headlineWordsMax: 24,
  leadWordsMax: 30,
  bodyWordsMax: 40,
  headlineToLeadGapPx: 10,
  stackGapPx: 40,
  contentMaxWidthTabletPx: 640,
  contentMaxWidthDesktopPx: 880,
  tabletMinWidthPx: 768,
  desktopMinWidthPx: 1024,
  layout: 'single-column',
} as const

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
