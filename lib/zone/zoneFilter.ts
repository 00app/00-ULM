/**
 * Zone wall filter: All / Do now / Long term.
 *
 * "Do now" is anything you can act on without spending real money or planning a project: claims,
 * switches, free habits, small buys. "Long term" is the capital and project work: insulation,
 * solar, a heat pump. The split comes from the library action's own `cost`, never from a guess
 * about the card's title, so a card can only land in Long term because it actually costs.
 */

import type { GroovyGridCell } from '@/lib/zone/gridOrder'
import type { ZoneAction } from '@/lib/actions/actionTypes'

export type ZoneFilter = 'all' | 'now' | 'long'
export type ZoneTimeframe = 'now' | 'long'

export const ZONE_FILTERS: ReadonlyArray<{ value: ZoneFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'now', label: 'Do now' },
  { value: 'long', label: 'Long term' },
]

/** Library action → timeframe. HIGH cost or a purchase is long term; everything else is now. */
export function timeframeForAction(a: Pick<ZoneAction, 'cost' | 'verb'>): ZoneTimeframe {
  return a.cost === 'HIGH' || a.verb === 'BUY' ? 'long' : 'now'
}

/** Category-level cards (no library action behind them, e.g. a guest wall): only solar is capital work. */
const LONG_TERM_JOURNEYS = new Set(['solar'])

export function cellTimeframe(cell: GroovyGridCell): ZoneTimeframe | null {
  if (cell.type === 'hero') return null
  // Tips are the small timely thing by definition.
  if (cell.type === 'tip') return 'now'
  return cell.item.timeframe ?? (LONG_TERM_JOURNEYS.has(cell.item.journey_key) ? 'long' : 'now')
}

export function matchesZoneFilter(cell: GroovyGridCell, filter: ZoneFilter): boolean {
  if (filter === 'all') return true
  const tf = cellTimeframe(cell)
  return tf === null ? true : tf === filter
}

export function countByTimeframe(cells: readonly GroovyGridCell[]): Record<ZoneTimeframe, number> {
  const out: Record<ZoneTimeframe, number> = { now: 0, long: 0 }
  for (const c of cells) {
    const tf = cellTimeframe(c)
    if (tf) out[tf] += 1
  }
  return out
}
