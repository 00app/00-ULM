import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
import type { GroovyGridCell } from '@/lib/zone/gridOrder'

export type SoloFocusNavEntry = {
  cardId: string
  journeyKey: JourneyId
  kind: 'journey' | 'tip'
  /** Nav rail label — mother cards use category; discovery tips use singular (e.g. grant). */
  label: string
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
        label: formatZoneCategoryLabel(cell.item.journey_key),
      })
    } else if (cell.type === 'tip') {
      const jid = (cell.tip.journey_key ?? 'home') as JourneyId
      ring.push({
        cardId: cell.tip.id,
        journeyKey: jid,
        kind: 'tip',
        label: singularSoloFocusNavLabel(jid),
      })
    }
  }
  return ring
}

/** Discovery / inject tips — singular lowercase label + arrow in nav (e.g. grant ↘). */
export function singularSoloFocusNavLabel(journeyKey: JourneyId): string {
  const full = formatZoneCategoryLabel(journeyKey).toLowerCase()
  if (full === 'utilities') return 'utility'
  if (full.endsWith('ies')) return `${full.slice(0, -3)}y`
  if (full.endsWith('s')) return full.slice(0, -1)
  return full
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
    prevLabel: formatZoneCategoryLabel(prev),
    nextLabel: formatZoneCategoryLabel(next),
  }
}

export function soloFocusNavNeighbors(
  currentCardId: string,
  ring: readonly SoloFocusNavEntry[]
): SoloFocusNavNeighbors | null {
  if (ring.length === 0) return null
  const i = ring.findIndex((e) => e.cardId === currentCardId)
  const idx = i >= 0 ? i : 0
  const len = ring.length
  const prev = ring[(idx - 1 + len) % len]!
  const next = ring[(idx + 1) % len]!
  return {
    prev,
    next,
    prevLabel: prev.label,
    nextLabel: next.label,
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
