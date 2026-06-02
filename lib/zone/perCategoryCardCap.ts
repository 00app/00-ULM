/**
 * Per-journey card ceiling on Zone: one journey bento at boot, at most one earned
 * discovery tip after a loop answer (2 cells per category on the main grid).
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'

/** Ranked `tip-*` from the view model do not nest on the main grid (journey tile is the starter card). */
export const SHOW_BASELINE_TIPS_ON_MAIN_GRID = false

/** Max discovery / inject tips nested under each journey on the bento wall. */
export const MAX_DISCOVERY_TIPS_PER_JOURNEY_ON_GRID = 1

/** Hard ceiling: max total cards (journey tile + tips combined) shown per category on the bento wall. */
export const MAX_CARDS_PER_CATEGORY = 2

/** Max saving-tip habits per journey on The Rock rail. */
export const MAX_SAVING_TIPS_PER_JOURNEY = 2

export function journeyKeyFromTip(tip: ZoneTipCard): JourneyId {
  const raw = (tip.journey_key ?? tip.category ?? 'home').trim().toLowerCase()
  return (JOURNEY_ORDER.includes(raw as JourneyId) ? raw : 'home') as JourneyId
}

/** Loop-answer / API birth only — not sentinel, fallback, or ranked `tip-*` baselines. */
export function isUserDiscoveryInjectTip(tip: ZoneTipCard): boolean {
  if (tip.achievement_discovery) return false
  const id = tip.id
  if (!id.startsWith('inject-')) return false
  if (id.startsWith('inject-sentinel-') || id.startsWith('inject-fallback-')) return false
  return true
}

/** Keep the last `maxPerJourney` tips per journey_key (stable JOURNEY_ORDER). */
export function capTipsPerJourney(tips: ZoneTipCard[], maxPerJourney: number): ZoneTipCard[] {
  if (maxPerJourney < 1) return []
  const byJourney = new Map<JourneyId, ZoneTipCard[]>()
  for (const tip of tips) {
    const jid = journeyKeyFromTip(tip)
    const bucket = byJourney.get(jid) ?? []
    bucket.push(tip)
    byJourney.set(jid, bucket)
  }
  const out: ZoneTipCard[] = []
  for (const jid of JOURNEY_ORDER) {
    const bucket = byJourney.get(jid) ?? []
    if (bucket.length > maxPerJourney) {
      out.push(...bucket.slice(bucket.length - maxPerJourney))
    } else {
      out.push(...bucket)
    }
  }
  for (const [jid, bucket] of byJourney) {
    if (JOURNEY_ORDER.includes(jid)) continue
    out.push(...bucket.slice(-maxPerJourney))
  }
  return out
}

export function capDiscoveryTipsForGrid(tips: ZoneTipCard[]): ZoneTipCard[] {
  return capTipsPerJourney(
    tips.filter(isUserDiscoveryInjectTip),
    MAX_DISCOVERY_TIPS_PER_JOURNEY_ON_GRID
  )
}

/** Discovery inject + achievement — max one tip cell per category (2 total with journey tile). */
export function isCategoryWallTip(tip: ZoneTipCard): boolean {
  if (tip.achievement_discovery) return true
  return isUserDiscoveryInjectTip(tip)
}

export function capCategoryWallTips(tips: ZoneTipCard[]): ZoneTipCard[] {
  return capTipsPerJourney(tips.filter(isCategoryWallTip), MAX_DISCOVERY_TIPS_PER_JOURNEY_ON_GRID)
}

/** First-win per journey lane — strips duplicate category rows before render. */
export function dedupeFirstWinByJourney<T extends { journey_key: JourneyId }>(items: T[]): T[] {
  const seen = new Set<JourneyId>()
  const out: T[] = []
  for (const item of items) {
    if (seen.has(item.journey_key)) continue
    seen.add(item.journey_key)
    out.push(item)
  }
  return out
}

/** Tips with `category` and/or `journey_key` — one row per lane (first wins). */
export function dedupeFirstWinByCategory<
  T extends { category?: JourneyId; journey_key?: JourneyId },
>(items: T[]): T[] {
  const seen = new Set<JourneyId>()
  const out: T[] = []
  for (const item of items) {
    const key = (item.journey_key ?? item.category) as JourneyId | undefined
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function capRockHabitsPerJourney<T extends { journey_key: JourneyId }>(
  habits: T[],
  maxPerJourney: number = MAX_SAVING_TIPS_PER_JOURNEY
): T[] {
  const cap = Math.max(1, maxPerJourney)
  const byJourney = new Map<JourneyId, T[]>()
  for (const h of habits) {
    const bucket = byJourney.get(h.journey_key) ?? []
    if (bucket.length < cap) {
      bucket.push(h)
      byJourney.set(h.journey_key, bucket)
    }
  }
  return JOURNEY_ORDER.flatMap((jid) => byJourney.get(jid) ?? [])
}
