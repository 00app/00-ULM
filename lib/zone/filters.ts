/**
 * Zone filters — one faceted model for the whole page.
 *
 * Three facets, all optional, combined with AND:
 *   - category   one journey (or all)
 *   - goal       money | carbon   (a card can match both)
 *   - pace       now | long       ("Do now" / "Long term": the action's own cost decides, see zoneFilter.ts)
 *
 * Counts are FACETED: the number on a category chip is how many cards you would get if you picked
 * it, given the goal and pace already chosen. So a chip never promises results it can't deliver,
 * and a chip with 0 is shown disabled instead of leading to an empty page.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import type { RecCardModel } from '@/lib/zone/recCard'
import { sortRecCards, BANK_CONNECT_CARD_ID } from '@/lib/zone/recCard'

export type GoalFilter = 'money' | 'carbon' | null
export type PaceFilter = 'now' | 'long' | null

export type ZoneFilterState = {
  category: JourneyId | null
  goal: GoalFilter
  pace: PaceFilter
}

export const DEFAULT_ZONE_FILTERS: ZoneFilterState = { category: null, goal: null, pace: null }

export const ZONE_FILTERS_STORAGE_KEY = 'zz_zone_filters_v1'

export function isFiltering(f: ZoneFilterState): boolean {
  return f.category !== null || f.goal !== null || f.pace !== null
}

export function activeFilterCount(f: ZoneFilterState): number {
  return (f.category ? 1 : 0) + (f.goal ? 1 : 0) + (f.pace ? 1 : 0)
}

/** Safe parse of whatever is in storage (unknown values are dropped, never trusted). */
export function parseZoneFilters(raw: unknown): ZoneFilterState {
  if (!raw || typeof raw !== 'object') return DEFAULT_ZONE_FILTERS
  const o = raw as Record<string, unknown>
  const category =
    typeof o.category === 'string' && (JOURNEY_ORDER as readonly string[]).includes(o.category)
      ? (o.category as JourneyId)
      : null
  return {
    category,
    goal: o.goal === 'money' || o.goal === 'carbon' ? o.goal : null,
    pace: o.pace === 'now' || o.pace === 'long' ? o.pace : null,
  }
}

/** The Connect card is a prompt, not a recommendation: it never takes part in filtering. */
function isFilterable(c: RecCardModel): boolean {
  return c.id !== BANK_CONNECT_CARD_ID
}

export function matchesFilters(c: RecCardModel, f: ZoneFilterState): boolean {
  if (f.category && c.category !== f.category) return false
  if (f.goal === 'money' && !c.impact.money) return false
  if (f.goal === 'carbon' && !c.impact.carbon) return false
  if (f.pace && c.pace !== f.pace) return false
  return true
}

/** Unique cards (first occurrence wins), without the Connect prompt. */
export function dedupeCards(cards: readonly RecCardModel[]): RecCardModel[] {
  const seen = new Set<string>()
  const out: RecCardModel[] = []
  for (const c of cards) {
    if (!isFilterable(c) || seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

/** Filtered results, verified £/yr first (same rule as every rail). */
export function applyFilters(cards: readonly RecCardModel[], f: ZoneFilterState): RecCardModel[] {
  return sortRecCards(dedupeCards(cards).filter((c) => matchesFilters(c, f)))
}

export type FacetCounts = {
  total: number
  /** Cards you'd get by picking each category, with goal + pace applied. Only categories with cards. */
  categories: { category: JourneyId; count: number }[]
  /** Cards you'd get by picking each goal, with category + pace applied. */
  goal: { money: number; carbon: number }
  /** Cards you'd get by picking each pace, with category + goal applied. */
  pace: { now: number; long: number }
}

export function facetCounts(cards: readonly RecCardModel[], f: ZoneFilterState): FacetCounts {
  const all = dedupeCards(cards)
  const count = (override: Partial<ZoneFilterState>) =>
    all.filter((c) => matchesFilters(c, { ...f, ...override })).length

  const present = new Set(all.map((c) => c.category))
  const categories = [...present]
    .sort((a, b) => JOURNEY_ORDER.indexOf(a) - JOURNEY_ORDER.indexOf(b))
    .map((category) => ({ category, count: count({ category }) }))

  return {
    total: applyFilters(cards, f).length,
    categories,
    goal: { money: count({ goal: 'money' }), carbon: count({ goal: 'carbon' }) },
    pace: { now: count({ pace: 'now' }), long: count({ pace: 'long' }) },
  }
}

/** Toggle: choosing the active value clears that facet. */
export function toggleCategory(f: ZoneFilterState, category: JourneyId): ZoneFilterState {
  return { ...f, category: f.category === category ? null : category }
}
export function toggleGoal(f: ZoneFilterState, goal: Exclude<GoalFilter, null>): ZoneFilterState {
  return { ...f, goal: f.goal === goal ? null : goal }
}
export function togglePace(f: ZoneFilterState, pace: Exclude<PaceFilter, null>): ZoneFilterState {
  return { ...f, pace: f.pace === pace ? null : pace }
}

const GOAL_LABEL = { money: 'Saves money', carbon: 'Cuts carbon' } as const
const PACE_LABEL = { now: 'Do now', long: 'Long term' } as const

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

/**
 * The heading for a filtered page, built from the filters themselves so the heading and the bar
 * can never disagree: "Home", "Saves money", "Home · Saves money · Do now".
 */
export function describeFilters(f: ZoneFilterState, categoryLabel: (c: JourneyId) => string): string {
  const parts: string[] = []
  if (f.category) parts.push(titleCase(categoryLabel(f.category)))
  if (f.goal) parts.push(GOAL_LABEL[f.goal])
  if (f.pace) parts.push(PACE_LABEL[f.pace])
  return parts.length ? parts.join(' · ') : 'All ideas'
}
