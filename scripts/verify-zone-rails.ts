/**
 * CI gate — Zone rails layout rules (no DB).
 * Run: npm run test:zone-rails
 */
import { buildZoneRails, MAX_BIGGEST_SAVINGS_CARDS } from '../lib/zone/rails'
import { resolveRecCard, type RecCardModel } from '../lib/zone/recCard'
import type { JourneyId } from '../lib/journeys'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean) {
  checks += 1
  if (!cond) failures.push(name)
}

function card(id: string, category: JourneyId, gbp: number | null, size: 'large' | 'small' = 'large'): RecCardModel {
  const c = resolveRecCard({
    id,
    size,
    category,
    label: category.toUpperCase(),
    actionWording: `do ${id}`,
    savingGbpPerYear: gbp,
    savingSource: gbp ? { kind: 'verified', name: 'example.gov.uk' } : null,
    whyYou: 'Based on where you live, Test Town.',
    openRef: { type: 'journey', id },
  })
  if (!c) throw new Error(`card ${id} failed to resolve`)
  return c
}

const recs = [
  card('a', 'home', null),
  card('b', 'home', 100),
  card('c', 'travel', 300),
  card('d', 'food', null),
  card('e', 'home', 50),
  card('f', 'travel', null),
]
const today = [card('t1', 'home', null, 'small'), card('t2', 'food', null, 'small')]

const { rails, pills } = buildZoneRails(recs, today)
const ids = rails.map((r) => r.id)

check('order starts biggest, today', ids[0] === 'biggest' && ids[1] === 'today')
const biggest = rails[0]
check('biggest sorted by verified £ desc, unverified after in existing order', biggest.cards.map((c) => c.id).join('') === 'cbeadf')
check('biggest is cross-category', new Set(biggest.cards.map((c) => c.category)).size === 3)
check('today keeps the caller order', rails[1].cards.map((c) => c.id).join('') === 't1t2')
check('today cards are small', rails[1].cards.every((c) => c.size === 'small'))

// categories need at least 2 cards: home (3) and travel (2) yes; food (1) no.
const catIds = rails.filter((r) => r.kind === 'category').map((r) => r.category)
check('categories with >=2 cards get a rail', catIds.includes('home') && catIds.includes('travel'))
check('categories with 1 card get no rail', !catIds.includes('food'))
check('pills match category rails exactly', pills.length === catIds.length && pills.every((p) => rails.some((r) => r.id === p.railId)))
const home = rails.find((r) => r.category === 'home')
check('category rail uses the same sort rule', home?.cards.map((c) => c.id).join('') === 'bea')
check('category with higher verified £ first', catIds[0] === 'travel')

// no cards at all -> no rails, no pills.
const empty = buildZoneRails([], [])
check('empty input -> no rails/pills', empty.rails.length === 0 && empty.pills.length === 0)

// Today alone still renders a rail.
check('today only', buildZoneRails([], today).rails.map((r) => r.id).join() === 'today')

// biggest is capped.
const many = Array.from({ length: 30 }, (_, i) => card(`m${i}`, 'home', i + 1))
check('biggest capped', buildZoneRails(many, []).rails[0].cards.length === MAX_BIGGEST_SAVINGS_CARDS)
check('biggest cap keeps the largest £', buildZoneRails(many, []).rails[0].cards[0].savingGbpPerYear === 30)

// Pills are jump links: they carry a rail id, never a filter value.
check('pills point at rails', pills.every((p) => p.railId.startsWith('category-')))

if (failures.length) {
  console.error('[zone-rails] FAILED')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(`[zone-rails] OK — ${checks} checks passed`)
