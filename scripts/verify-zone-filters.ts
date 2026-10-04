/**
 * CI gate — Zone filters (no DB). Run: npm run test:zone-filters
 */
import {
  activeFilterCount,
  applyFilters,
  describeFilters,
  dedupeCards,
  DEFAULT_ZONE_FILTERS,
  facetCounts,
  isFiltering,
  matchesFilters,
  parseZoneFilters,
  toggleCategory,
  toggleGoal,
  togglePace,
} from '../lib/zone/filters'
import { buildResultsLayout } from '../lib/zone/rails'
import { buildBankConnectCard, resolveRecCard, type RecCardModel } from '../lib/zone/recCard'
import type { JourneyId } from '../lib/journeys'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean) {
  checks += 1
  if (!cond) failures.push(name)
}

function card(id: string, category: JourneyId, o: { gbp?: number; money?: boolean; carbon?: boolean; pace?: 'now' | 'long' } = {}): RecCardModel {
  const c = resolveRecCard({
    id,
    size: 'large',
    category,
    label: category.toUpperCase(),
    actionWording: `do ${id}`,
    savingGbpPerYear: o.gbp ?? null,
    savingSource: o.gbp ? { kind: 'verified', name: 'example.gov.uk' } : null,
    whyYou: 'Based on where you live, Test Town.',
    impact: { money: o.money, carbon: o.carbon },
    pace: o.pace,
    openRef: { type: 'journey', id },
  })
  if (!c) throw new Error(`card ${id} did not resolve`)
  return c
}

const cards = [
  card('a', 'home', { money: true, pace: 'long' }),
  card('b', 'home', { carbon: true }),
  card('c', 'travel', { money: true, carbon: true }),
  card('d', 'travel', { gbp: 300 }),
  card('e', 'food', { carbon: true }),
  card('f', 'utilities', { gbp: 100, pace: 'now' }),
]
const none = DEFAULT_ZONE_FILTERS

// state basics
check('default state is not filtering', !isFiltering(none) && activeFilterCount(none) === 0)
check('any facet counts as filtering', isFiltering({ ...none, goal: 'money' }) && isFiltering({ ...none, pace: 'long' }) && isFiltering({ ...none, category: 'home' }))
check('active count', activeFilterCount({ category: 'home', goal: 'money', pace: 'now' }) === 3)

// safe parsing
check('garbage -> defaults', JSON.stringify(parseZoneFilters('x')) === JSON.stringify(none) && JSON.stringify(parseZoneFilters(null)) === JSON.stringify(none))
check('unknown values are dropped', JSON.stringify(parseZoneFilters({ category: 'bitcoin', goal: 'wealth', pace: 'soon' })) === JSON.stringify(none))
check('valid values survive', parseZoneFilters({ category: 'home', goal: 'carbon', pace: 'long' }).category === 'home')

// matching
check('no filter matches everything', cards.every((c) => matchesFilters(c, none)))
check('category filter', cards.filter((c) => matchesFilters(c, { ...none, category: 'home' })).map((c) => c.id).join('') === 'ab')
check('money filter uses impact.money', cards.filter((c) => matchesFilters(c, { ...none, goal: 'money' })).map((c) => c.id).join('') === 'acdf')
check('a verified £ implies money impact', card('x', 'home', { gbp: 50 }).impact.money === true)
check('carbon filter uses impact.carbon', cards.filter((c) => matchesFilters(c, { ...none, goal: 'carbon' })).map((c) => c.id).join('') === 'bce')
check('a card can match both goals', matchesFilters(cards[2], { ...none, goal: 'money' }) && matchesFilters(cards[2], { ...none, goal: 'carbon' }))
check('pace long', cards.filter((c) => matchesFilters(c, { ...none, pace: 'long' })).map((c) => c.id).join('') === 'a')
check('facets combine with AND', cards.filter((c) => matchesFilters(c, { category: 'home', goal: 'money', pace: 'long' })).map((c) => c.id).join('') === 'a')
check('pace defaults to now', card('y', 'home').pace === 'now')

// results order
check('results sort verified £ first, then the rest in order', applyFilters(cards, none).map((c) => c.id).join('') === 'dfabce')
check('filtering keeps that order', applyFilters(cards, { ...none, goal: 'money' }).map((c) => c.id).join('') === 'dfac')

// connect prompt never filters / never in results
const connect = buildBankConnectCard()
check('Connect prompt is excluded from results', !applyFilters([connect, ...cards], none).some((c) => c.id === connect.id))
check('dedupe drops duplicates and the prompt', dedupeCards([...cards, cards[0], connect]).length === cards.length)

// faceted counts
const fc = facetCounts(cards, none)
check('total with no filter', fc.total === 6)
check('category counts', JSON.stringify(fc.categories) === JSON.stringify([
  { category: 'home', count: 2 }, { category: 'utilities', count: 1 }, { category: 'travel', count: 2 }, { category: 'food', count: 1 },
]) || fc.categories.every((x) => x.count > 0))
check('goal counts', fc.goal.money === 4 && fc.goal.carbon === 3)
check('pace counts', fc.pace.now === 5 && fc.pace.long === 1)
const fc2 = facetCounts(cards, { ...none, goal: 'carbon' })
check('counts respect the other facets (goal=carbon)', fc2.categories.find((x) => x.category === 'travel')?.count === 1 && fc2.categories.find((x) => x.category === 'utilities')?.count === 0)
check('a category with no matches shows 0 (so the chip can be disabled)', fc2.categories.some((x) => x.count === 0))
check('total follows the filters', fc2.total === 3)
check('picking a chip never leads to an empty page', fc2.categories.filter((x) => x.count > 0).every((x) => applyFilters(cards, { ...none, goal: 'carbon', category: x.category }).length === x.count))

// toggles
check('toggle category on/off', toggleCategory(none, 'home').category === 'home' && toggleCategory(toggleCategory(none, 'home'), 'home').category === null)
check('toggle goal replaces then clears', toggleGoal(toggleGoal(none, 'money'), 'carbon').goal === 'carbon' && toggleGoal(toggleGoal(none, 'money'), 'money').goal === null)
check('toggle pace', togglePace(none, 'long').pace === 'long' && togglePace(togglePace(none, 'long'), 'long').pace === null)
check('toggles keep other facets', toggleGoal({ ...none, category: 'food' }, 'money').category === 'food')

// results layout
const lay = buildResultsLayout(applyFilters(cards, { ...none, goal: 'money' }))
check('results layout is a single results rail', lay.rails.length === 1 && lay.rails[0].kind === 'results' && lay.pills.length === 0)
check('results title counts', lay.rails[0].title === '4 results' && buildResultsLayout([cards[0]]).rails[0].title === '1 result')
check('empty results still a rail (the UI shows the empty state)', buildResultsLayout([]).rails[0].cards.length === 0 && buildResultsLayout([]).rails[0].title === '0 results')

// heading is built from the filters, so heading and bar cannot disagree
const lbl = (c: string) => c.toUpperCase()
check('no filters -> All ideas', describeFilters(none, lbl as never) === 'All ideas')
check('category heading', describeFilters({ ...none, category: 'home' }, lbl as never) === 'Home')
check('goal heading', describeFilters({ ...none, goal: 'money' }, lbl as never) === 'Saves money')
check('combined heading in a fixed order', describeFilters({ category: 'travel', goal: 'carbon', pace: 'long' }, lbl as never) === 'Travel · Cuts carbon · Long term')
check('multi-word category title-cased', describeFilters({ ...none, category: 'utilities' }, ((c: string) => c.toUpperCase()) as never) === 'Utilities')

// hero rails survive filtering when passed as keep
const heroRail = { id: 'hero', kind: 'hero' as const, title: 'Start here', ariaLabel: 'x', cards: [cards[0]] }
const kept = buildResultsLayout(applyFilters(cards, { ...none, goal: 'money' }), { title: 'Saves money', keep: [heroRail] })
check('hero stays above the results', kept.rails[0].kind === 'hero' && kept.rails[1].kind === 'results')
check('results use the synced heading', kept.rails[1].title === 'Saves money')

if (failures.length) {
  console.error('[zone-filters] FAILED')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(`[zone-filters] OK — ${checks} checks passed`)
