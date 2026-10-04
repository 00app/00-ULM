/**
 * Zone rails (Model A): pure layout rules, no React.
 *
 *   1. "Biggest savings"  — cross-category, large cards, verified £/yr descending, unverified after
 *   2. "Today"            — small cards, caller's (season-ranked) order untouched
 *   3. one rail per category, same sort rule — only for categories with at least 2 cards
 *
 * Category pills are jump links to a rail, never filters.
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
import { sortRecCards, type RecCardModel } from '@/lib/zone/recCard'

export const MIN_CARDS_FOR_CATEGORY_RAIL = 2
export const MAX_BIGGEST_SAVINGS_CARDS = 12
export const MAX_HERO_CARDS = 3

export type ZoneRail = {
  id: string
  kind: 'hero' | 'biggest' | 'today' | 'category' | 'results'
  title: string
  ariaLabel: string
  category?: JourneyId
  cards: RecCardModel[]
}

export type ZoneRailPill = { id: string; label: string; railId: string }

export type ZoneRailsLayout = { rails: ZoneRail[]; pills: ZoneRailPill[] }

export function railDomId(railId: string): string {
  return `zone-rail-${railId}`
}

/** `recs` = large recommendation cards (any order). `today` = small Today cards, already ranked. */
export function buildZoneRails(
  recs: readonly RecCardModel[],
  today: readonly RecCardModel[],
  opts: { pinnedFirst?: RecCardModel | null; heroCards?: readonly RecCardModel[] } = {}
): ZoneRailsLayout {
  const rails: ZoneRail[] = []

  // Hero: the profile's top wins (Quick win / Big win / Do now), featured above everything. Kept in
  // the caller's order (that order is the meaning), exempt from the >=2 and sort rules.
  const hero = (opts.heroCards ?? []).slice(0, MAX_HERO_CARDS)
  if (hero.length > 0) {
    rails.push({
      id: 'hero',
      kind: 'hero',
      title: 'Start here',
      ariaLabel: 'Your top three picks',
      cards: [...hero],
    })
  }
  const sortedAll = sortRecCards(recs)

  // A pinned card (the bank Connect card) leads the rail, outside the sort and the cap.
  const pinned = opts.pinnedFirst ?? null
  if (sortedAll.length > 0 || pinned) {
    rails.push({
      id: 'biggest',
      kind: 'biggest',
      title: 'Biggest savings',
      ariaLabel: 'Biggest savings, across all categories',
      cards: [...(pinned ? [pinned] : []), ...sortedAll.slice(0, MAX_BIGGEST_SAVINGS_CARDS)],
    })
  }

  if (today.length > 0) {
    rails.push({
      id: 'today',
      kind: 'today',
      title: 'Today',
      ariaLabel: 'Today',
      cards: [...today],
    })
  }

  const byCategory = new Map<JourneyId, RecCardModel[]>()
  for (const c of recs) {
    const list = byCategory.get(c.category) ?? []
    list.push(c)
    byCategory.set(c.category, list)
  }
  const categories = [...byCategory.entries()]
    .filter(([, cards]) => cards.length >= MIN_CARDS_FOR_CATEGORY_RAIL)
    .map(([category, cards]) => ({ category, cards: sortRecCards(cards) }))
    .sort((a, b) => {
      const top = (x: { cards: RecCardModel[] }) => x.cards[0]?.savingGbpPerYear ?? 0
      return top(b) - top(a) || JOURNEY_ORDER.indexOf(a.category) - JOURNEY_ORDER.indexOf(b.category)
    })

  const pills: ZoneRailPill[] = []
  for (const { category, cards } of categories) {
    const label = formatZoneCategoryLabel(category)
    const id = `category-${category}`
    rails.push({
      id,
      kind: 'category',
      title: label.charAt(0) + label.slice(1).toLowerCase(),
      ariaLabel: `${label.toLowerCase()} recommendations`,
      category,
      cards,
    })
    pills.push({ id: `pill-${category}`, label, railId: id })
  }

  return { rails, pills }
}

/**
 * While a filter is active the page is ONE result list (not rails): rails mean "browse", filters
 * mean "show me exactly these". `cards` must already be filtered and sorted.
 */
export function buildResultsLayout(
  cards: readonly RecCardModel[],
  opts: { title?: string; keep?: readonly ZoneRail[] } = {}
): ZoneRailsLayout {
  return {
    rails: [
      // Rails that stay put while filtering (the hero picks): they are personal, not browse content.
      ...(opts.keep ?? []),
      {
        id: 'results',
        kind: 'results',
        title: opts.title ?? (cards.length === 1 ? '1 result' : `${cards.length} results`),
        ariaLabel: 'Filtered recommendations',
        cards: [...cards],
      },
    ],
    pills: [],
  }
}
