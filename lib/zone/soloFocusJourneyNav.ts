import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
import type { GroovyGridCell } from '@/lib/zone/gridOrder'
import { isCategoryWallTip, journeyKeyFromTip } from '@/lib/zone/perCategoryCardCap'
import {
  formatSoloFocusNavMotherLabel,
  formatSoloFocusNavTipLabel,
  navRailDestinationLabel,
} from '@/lib/zone/soloFocusNavLabels'

export { singularSoloFocusNavLabel } from '@/lib/zone/soloFocusNavLabels'

export type SoloFocusNavEntry = {
  cardId: string
  journeyKey: JourneyId
  kind: 'journey' | 'tip'
  /** Nav rail label — mother cards use category; discovery tips use singular (e.g. grant). */
  label: string
}

/** In-session morph / sibling cards (Solo Focus deck) — not always on the bento wall yet. */
export type MorphNavCard = {
  id: string
  journey_key?: JourneyId | string
  heading?: string | null
  title?: string | null
}

export type SoloFocusJourneyNeighbors = {
  prev: JourneyId
  next: JourneyId
  prevLabel: string
  nextLabel: string
}

export type SoloFocusNavNeighbors = {
  prev: SoloFocusNavEntry
  next: SoloFocusNavEntry
  prevLabel: string
  nextLabel: string
}

/** Journey keys for bento mother cards currently on the Zone wall (JOURNEY_ORDER sequence). */
export function journeyKeysFromDisplayItems(
  items: ReadonlyArray<{ type: string; item?: { journey_key?: JourneyId } }>
): JourneyId[] {
  const keys: JourneyId[] = []
  for (const cell of items) {
    if (cell.type === 'journey' && cell.item?.journey_key) {
      keys.push(cell.item.journey_key)
    }
  }
  return keys
}

/** Wall-order ring — mother journey cells + nested discovery/baseline tips. */
export function soloFocusNavRingFromDisplayItems(items: ReadonlyArray<GroovyGridCell>): SoloFocusNavEntry[] {
  const ring: SoloFocusNavEntry[] = []
  for (const cell of items) {
    if (cell.type === 'journey') {
      ring.push({
        cardId: cell.item.id,
        journeyKey: cell.item.journey_key,
        kind: 'journey',
        label: formatSoloFocusNavMotherLabel(cell.item.journey_key),
      })
    } else if (cell.type === 'tip') {
      const jid = (cell.tip.journey_key ?? 'home') as JourneyId
      ring.push({
        cardId: cell.tip.id,
        journeyKey: jid,
        kind: 'tip',
        label: formatSoloFocusNavTipLabel(cell.tip.title, jid),
      })
    }
  }
  return ring
}

function navEntryFromTip(tip: ZoneTipCard): SoloFocusNavEntry {
  const jid = journeyKeyFromTip(tip)
  return {
    cardId: tip.id,
    journeyKey: jid,
    kind: 'tip',
    label: formatSoloFocusNavTipLabel(tip.title, jid),
  }
}

/** Insert earned discovery / achievement tips after their mother journey when not yet on the wall grid. */
export function mergeSoloFocusNavExtras(
  wallRing: readonly SoloFocusNavEntry[],
  extraTips: readonly ZoneTipCard[]
): SoloFocusNavEntry[] {
  const ids = new Set(wallRing.map((e) => e.cardId))
  const pendingByJourney = new Map<JourneyId, SoloFocusNavEntry[]>()

  for (const tip of extraTips) {
    if (!tip.id?.trim() || ids.has(tip.id)) continue
    if (!isCategoryWallTip(tip)) continue
    const entry = navEntryFromTip(tip)
    const bucket = pendingByJourney.get(entry.journeyKey) ?? []
    bucket.push(entry)
    pendingByJourney.set(entry.journeyKey, bucket)
  }

  if (pendingByJourney.size === 0) return [...wallRing]

  const out: SoloFocusNavEntry[] = []
  for (const entry of wallRing) {
    out.push(entry)
    if (entry.kind !== 'journey') continue
    const extras = pendingByJourney.get(entry.journeyKey) ?? []
    for (const ex of extras) {
      if (ids.has(ex.cardId)) continue
      out.push(ex)
      ids.add(ex.cardId)
    }
    pendingByJourney.delete(entry.journeyKey)
  }
  for (const extras of pendingByJourney.values()) {
    for (const ex of extras) {
      if (!ids.has(ex.cardId)) {
        out.push(ex)
        ids.add(ex.cardId)
      }
    }
  }
  return out
}

/** Wall-order ring + inject/achievement tips earned in-session (may lag `displayItems` by one render). */
export function buildSoloFocusNavRing(
  displayItems: ReadonlyArray<GroovyGridCell>,
  extraTips?: readonly ZoneTipCard[]
): SoloFocusNavEntry[] {
  const wall = soloFocusNavRingFromDisplayItems(displayItems)
  if (!extraTips?.length) return wall
  return mergeSoloFocusNavExtras(wall, extraTips)
}

function morphNavLabel(m: MorphNavCard, journeyKey: JourneyId): string {
  return formatSoloFocusNavTipLabel(String(m.heading ?? m.title ?? ''), journeyKey)
}

/** Insert morph / sibling cards after the open wall cell (mother or nested tip). */
export function mergeMorphDeckIntoNavRing(
  ring: readonly SoloFocusNavEntry[],
  anchorJourneyId: JourneyId,
  morphDeck: readonly MorphNavCard[],
  anchorCardId?: string | null
): SoloFocusNavEntry[] {
  if (!morphDeck.length) return [...ring]
  const anchor = anchorCardId?.trim()
  let insertAfter = anchor ? ring.findIndex((e) => e.cardId === anchor) : -1
  if (insertAfter < 0) {
    insertAfter = ring.findIndex((e) => e.kind === 'journey' && e.journeyKey === anchorJourneyId)
  }
  if (insertAfter < 0) {
    insertAfter = ring.findIndex((e) => e.journeyKey === anchorJourneyId)
  }
  if (insertAfter < 0) return [...ring]

  const seen = new Set(ring.map((e) => e.cardId))
  const morphEntries: SoloFocusNavEntry[] = []
  for (const m of morphDeck) {
    const id = m.id?.trim()
    if (!id || seen.has(id)) continue
    const jid = (m.journey_key ?? anchorJourneyId) as JourneyId
    seen.add(id)
    morphEntries.push({
      cardId: id,
      journeyKey: jid,
      kind: 'tip',
      label: morphNavLabel(m, jid),
    })
  }
  if (!morphEntries.length) return [...ring]
  const out = [...ring]
  out.splice(insertAfter + 1, 0, ...morphEntries)
  return out
}

function neighborRing(availableOnWall?: readonly JourneyId[]): readonly JourneyId[] {
  if (availableOnWall && availableOnWall.length > 0) return availableOnWall
  return JOURNEY_ORDER
}

export function soloFocusJourneyNeighbors(
  current: JourneyId,
  availableOnWall?: readonly JourneyId[]
): SoloFocusJourneyNeighbors {
  const ring = neighborRing(availableOnWall)
  const i = ring.indexOf(current)
  const idx = i >= 0 ? i : 0
  const len = ring.length
  const prev = ring[(idx - 1 + len) % len]!
  const next = ring[(idx + 1) % len]!
  return {
    prev,
    next,
    prevLabel: formatSoloFocusNavMotherLabel(prev),
    nextLabel: formatSoloFocusNavMotherLabel(next),
  }
}

/** Index in the nav ring for the open Solo Focus card (mother or nested tip). */
export function resolveSoloFocusNavRingIndex(
  ring: readonly SoloFocusNavEntry[],
  currentCardId?: string | null,
  journeyId?: JourneyId
): number {
  if (ring.length === 0) return 0
  const id = currentCardId?.trim()
  if (id) {
    const byId = ring.findIndex((e) => e.cardId === id)
    if (byId >= 0) return byId
  }
  if (journeyId) {
    const motherId = id?.startsWith('journey-') ? id : `journey-${journeyId}`
    const motherIdx = ring.findIndex((e) => e.kind === 'journey' && e.cardId === motherId)
    if (motherIdx >= 0) return motherIdx
    const journeyTipIdx = ring.findIndex((e) => e.journeyKey === journeyId && e.cardId === id)
    if (journeyTipIdx >= 0) return journeyTipIdx
    if (id?.startsWith('inject-') || id?.startsWith('rock-') || id?.startsWith('tip-')) {
      const tipIdx = ring.findIndex((e) => e.kind === 'tip' && e.cardId === id)
      if (tipIdx >= 0) return tipIdx
    }
  }
  return 0
}

/** Step prev/next skipping adjacent duplicates of the same cardId (avoids "reload same card"). */
export function advanceNavRingIndex(
  ring: readonly SoloFocusNavEntry[],
  idx: number,
  delta: -1 | 1
): number {
  const len = ring.length
  if (len <= 1) return idx
  const current = ring[idx]
  const currentId = current?.cardId
  let step = 0
  let next = idx
  do {
    next = (next + delta + len) % len
    step++
    const candidate = ring[next]!
    if (currentId && candidate.cardId === currentId) continue
    // Morph on a journey mother: never "step" to the same journey mother tile again.
    if (
      currentId?.startsWith('morph-') &&
      candidate.kind === 'journey' &&
      current?.journeyKey &&
      candidate.journeyKey === current.journeyKey
    ) {
      continue
    }
    // Forward from a nested tip: skip the same-journey mother (visit the next category).
    if (
      delta === 1 &&
      current?.kind === 'tip' &&
      candidate.kind === 'journey' &&
      current.journeyKey &&
      candidate.journeyKey === current.journeyKey
    ) {
      continue
    }
    // Backward from a journey mother: skip nested tips under that category.
    if (
      delta === -1 &&
      current?.kind === 'journey' &&
      candidate.kind === 'tip' &&
      current.journeyKey &&
      candidate.journeyKey === current.journeyKey
    ) {
      continue
    }
    // Nav rail shows category only — never echo the open journey on prev/next.
    if (current?.journeyKey && candidate.journeyKey === current.journeyKey) {
      continue
    }
    break
  } while (step < len)
  if (next === idx && len > 1) {
    return (idx + delta + len) % len
  }
  return next
}

/** Resolve the wall-ring neighbor entry for prev/next (buttons, swipe, arrows). */
export function stepSoloFocusNavRing(
  ring: readonly SoloFocusNavEntry[],
  currentCardId: string | null | undefined,
  journeyId: JourneyId | undefined,
  delta: -1 | 1
): SoloFocusNavEntry | null {
  if (ring.length <= 1) return null
  const idx = resolveSoloFocusNavRingIndex(ring, currentCardId, journeyId)
  const nextIdx = advanceNavRingIndex(ring, idx, delta)
  if (nextIdx === idx) return null
  return ring[nextIdx] ?? null
}

export function soloFocusNavNeighbors(
  currentCardId: string,
  ring: readonly SoloFocusNavEntry[],
  journeyId?: JourneyId
): SoloFocusNavNeighbors | null {
  if (ring.length === 0) return null
  const idx = resolveSoloFocusNavRingIndex(ring, currentCardId, journeyId)
  const prevIdx = advanceNavRingIndex(ring, idx, -1)
  const nextIdx = advanceNavRingIndex(ring, idx, 1)
  const prev = ring[prevIdx]!
  const next = ring[nextIdx]!
  return {
    prev,
    next,
    prevLabel: navRailDestinationLabel(prev.journeyKey),
    nextLabel: navRailDestinationLabel(next.journeyKey),
  }
}

/** Resolve a journey key to a grid cell, walking forward in JOURNEY_ORDER when the target is off-wall. */
export function resolveJourneyCellForSoloFocusNav<T extends { journey_key: JourneyId }>(
  target: JourneyId,
  findCell: (key: JourneyId) => T | undefined,
  availableOnWall?: readonly JourneyId[]
): T | undefined {
  const direct = findCell(target)
  if (direct) return direct

  const start = JOURNEY_ORDER.indexOf(target)
  if (start < 0) return undefined

  const allowed =
    availableOnWall && availableOnWall.length > 0
      ? new Set<JourneyId>(availableOnWall)
      : new Set<JourneyId>(JOURNEY_ORDER)

  for (let step = 0; step < JOURNEY_ORDER.length; step++) {
    const key = JOURNEY_ORDER[(start + step) % JOURNEY_ORDER.length]!
    if (!allowed.has(key)) continue
    const cell = findCell(key)
    if (cell) return cell
  }
  return undefined
}
