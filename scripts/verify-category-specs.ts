/**
 * CI gate — category specs (Z6). Synthetic data only; no DB, no network.
 *
 *  1. Spec integrity: 13 specs, 3–4 metrics each, rule ids prefixed by category, every fact a rule
 *     or metric reads is in the household registry, every action id is in the library or the §10
 *     NEW list.
 *  2. Stories: per category, a synthetic household with the story produces the expected finding
 *     and action (docs/INTELLIGENCE-LOGIC.md §12 plus one story per category).
 *  3. Mechanical truth: every card for all 1,000 synthetic households meets the InsightCard
 *     contract; no figure without a source; no NEW action is ever linked.
 *
 * Run: npm run test:category-specs
 */

import { ZONE_ACTIONS } from '../lib/actions/actionLibrary'
import {
  ALL_FACT_KEYS,
  buildHousehold,
  generateSyntheticHouseholds,
  type AccountInput,
  type HouseholdInputs,
} from '../lib/household'
import { CATEGORY_SPECS, CATEGORY_SPEC_ORDER, NEW_ACTION_IDS, buildCategoryInsights } from '../lib/intelligence/categories'
import { InsightCardSchema, type InsightCard } from '../lib/zone/insightCard'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean, detail?: string) {
  checks += 1
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

const now = new Date('2026-10-25T09:00:00Z')
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
const LIBRARY = new Set(ZONE_ACTIONS.map((a) => a.id))
const DOC_NEW_IDS = new Set([
  'sim-only-switch', 'time-of-use-tariff', 'energy-credit-refund', 'easy-access-savings-compare', 'membership-pause-or-downgrade',
  'pet-insurance-renewal-check', 'leisure-concession', 'landlord-epc-letter', 'flood-re-insurance-check', 'home-insurance-renewal-check',
  'pay-per-mile-insurance', 'ev-salary-sacrifice', 'annual-travel-insurance', 'ghic-free-card', 'rail-instead-of-short-flight',
  'food-waste-planning', 'supermarket-loyalty-prices', 'energy-label-compare', 'solar-mcs-quotes', 'solar-battery-check',
  'home-compost', 'food-caddy-request',
])
const FACT_KEYS = new Set(ALL_FACT_KEYS)

// ── 1. spec integrity ─────────────────────────────────────────────────────────────────────────

check('13 category specs', CATEGORY_SPEC_ORDER.length === 13 && Object.keys(CATEGORY_SPECS).length === 13)
check('deep categories first', CATEGORY_SPEC_ORDER.slice(0, 5).join() === 'tech,utilities,money,lifestyle,home')
for (const id of CATEGORY_SPEC_ORDER) {
  const spec = CATEGORY_SPECS[id]
  check(`${id}: spec id matches`, spec.id === id)
  check(`${id}: 3 or 4 metrics`, spec.metrics.length >= 3 && spec.metrics.length <= 4, String(spec.metrics.length))
  check(`${id}: depth`, (CATEGORY_SPEC_ORDER.indexOf(id) < 5) === (spec.depth === 'deep'))
  for (const m of spec.metrics) {
    check(`${id}.${m.key}: needs are registry facts`, m.needs.every((k) => FACT_KEYS.has(k)), m.needs.join(','))
    check(`${id}.${m.key}: unknown metric names what fills it`, m.needs.length > 0 || Boolean(m.referenceField))
  }
  for (const r of spec.rules) {
    check(`${r.id}: prefixed by category`, r.id.startsWith(`${id}.`))
    check(`${r.id}: drivers are registry facts`, r.drivers.every((k) => FACT_KEYS.has(k)), r.drivers.filter((k) => !FACT_KEYS.has(k)).join(','))
    check(`${r.id}: 2 or 3 options`, r.options.length >= 2 && r.options.length <= 3)
    check(`${r.id}: every option states a trade-off`, r.options.every((o) => o.tradeOff.trim().length > 0))
    const ids = [...r.actions, ...r.options.map((o) => o.actionId).filter((x): x is string => Boolean(x))]
    check(`${r.id}: actions are in the library or the §10 NEW list`, ids.every((a) => LIBRARY.has(a) || DOC_NEW_IDS.has(a)), ids.filter((a) => !LIBRARY.has(a) && !DOC_NEW_IDS.has(a)).join(','))
    if (r.deadlineFact) check(`${r.id}: deadline fact is a registry fact`, FACT_KEYS.has(r.deadlineFact))
  }
}
check('every unbuilt action is on the §10 list', NEW_ACTION_IDS.every((a) => DOC_NEW_IDS.has(a)), NEW_ACTION_IDS.join(','))

// ── 2. stories ────────────────────────────────────────────────────────────────────────────────

const base = (over: Partial<HouseholdInputs> = {}): HouseholdInputs => ({
  identity: { kind: 'synthetic', syntheticId: 'story' },
  postcode: 'ZZ99 1AA',
  profile: { homeOwnership: 'OWNER', financialPressure: 'DOING_OK', livingSituation: 'COUPLE', employmentStatus: 'EMPLOYED', age: 'MID', powerType: 'GAS', transport: 'CAR', washPreference: 'SHOWER', country: 'ENGLAND' },
  profileAsOf: '2026-06-01T00:00:00Z',
  journeyAnswers: null,
  journeyAnswersAsOf: null,
  loopAnswers: null,
  loopAnswersAsOf: '2026-10-20T00:00:00Z',
  property: null,
  accounts: [],
  bank: null,
  storedFacts: [],
  ...over,
})
const acc = (a: Partial<AccountInput> & Pick<AccountInput, 'category'>): AccountInput => ({
  id: `acc-${a.category}`,
  provider_name: null,
  monthly_amount_pence: null,
  renewal_date: null,
  contract_end_date: null,
  source: 'manual',
  status: 'active',
  updated_at: '2026-10-01T00:00:00Z',
  ...a,
})
const epc = (band: string) => ({
  epc: { found: true, postcode: 'ZZ991AA', currentEnergyRating: band, potentialEnergyRating: 'B', mainFuel: 'mains gas (not community)', currentThermalEfficiencyMultiplier: 1, description: 't', lodgementDate: '2022-03-01', addressMatched: true, isStale: false },
  enrichedAt: '2026-10-20T00:00:00Z',
  confidence: 'ADDRESS_MATCHED' as const,
})
const cardsFor = (inputs: HouseholdInputs, at = now) => buildCategoryInsights(buildHousehold(inputs, at), { now: at })
const card = (r: ReturnType<typeof cardsFor>, id: string): InsightCard | undefined => r.cards.find((c) => c.id === id)
const has = (r: ReturnType<typeof cardsFor>, id: string) => Boolean(card(r, id))

// §12 Broadband ended 4 months ago: finding, options, confidence high from bank / medium told.
{
  const typed = cardsFor(base({ accounts: [acc({ category: 'broadband', provider_name: 'BT', monthly_amount_pence: 4200, contract_end_date: day(-125) })] }))
  const c = card(typed, 'tech:broadband_out_of_contract')
  check('broadband: finding shown', Boolean(c))
  check('broadband: headline says 4 months', c?.headline === 'Your broadband deal ended 4 months ago', c?.headline)
  check('broadband: switch, haggle, remind', c?.options.map((o) => o.key).join() === 'switch,haggle,remind_30')
  check('broadband: linked to the library action', c?.options[0].actionId === 'out-of-contract-broadband')
  check('broadband: typed bill is medium confidence', c?.confidence.level === 'medium')
  const bank = cardsFor(base({ accounts: [acc({ category: 'broadband', provider_name: 'BT', monthly_amount_pence: 4200, contract_end_date: day(-125), source: 'bank' })] }))
  const b = card(bank, 'tech:broadband_out_of_contract')
  check('broadband: from the bank is high confidence', b?.confidence.level === 'high')
  check('broadband: from the bank is live data', b?.statusTag === 'live_data')
  check('broadband: why names the contract end date', b?.why.some((w) => w.factKey === 'broadband_contract_end') ?? false)
}
// §12 Gym 1 visit a month: cost per visit computed and sourced to the account.
{
  const r = cardsFor(base({ accounts: [acc({ category: 'membership', provider_name: 'Local gym', monthly_amount_pence: 3500, uses_per_month: 1 })] }))
  const c = card(r, 'lifestyle:low_use_membership')
  check('gym: low-use membership shown', Boolean(c))
  const cpv = c?.metrics.find((m) => m.key === 'cost_per_visit')
  check('gym: cost per visit is £35', cpv?.value === 35, String(cpv?.value))
  check('gym: cost per visit sourced to the account', cpv?.source?.name === 'Accounts you added')
  check('gym: headline is value per use', c?.headline === 'Each visit to Local gym costs you £35.00', c?.headline)
  check('gym: pause, off-peak, downgrade', c?.options.map((o) => o.key).join() === 'pause,off_peak,downgrade')
  const loop = cardsFor(base({ loopAnswers: { lifestyle_visits: 'NONE OR ONCE' } }))
  check('gym: the loop answer alone also triggers it', has(loop, 'lifestyle:low_use_membership'))
  check('gym: frequent use does not', !has(cardsFor(base({ loopAnswers: { lifestyle_visits: 'OFTEN' } })), 'lifestyle:low_use_membership'))
}
// §12 Renter, EPC E: renter standard, not the retrofit grant.
{
  const r = cardsFor(base({ profile: { ...base().profile, homeOwnership: 'RENTER' }, property: epc('E') }))
  check('renter EPC E: renter standard shown', has(r, 'home:renter_standard'))
  check('renter EPC E: retrofit grant not shown', !has(r, 'home:retrofit_grant'))
}
// §12 Owner, EPC D, gas: retrofit grant with BUS from the library.
{
  const r = cardsFor(base({ property: epc('D') }))
  const c = card(r, 'home:retrofit_grant')
  check('owner EPC D: retrofit grant shown', Boolean(c))
  check('owner EPC D: BUS offered', c?.options.some((o) => o.actionId === 'boiler-upgrade-scheme') ?? false)
  check('owner EPC D: EPC is a sourced driver', c?.why.some((w) => w.factKey === 'epc_band' && w.source.name === 'EPC register') ?? false)
  const tight = cardsFor(base({ profile: { ...base().profile, financialPressure: 'TIGHT' }, property: epc('D') }))
  check('owner EPC D but TIGHT: HIGH-cost grant hidden by the cost ceiling', !has(tight, 'home:retrofit_grant'))
}
// §12 Variable tariff, fix ends in 20 days: both findings, fix ending first.
{
  const r = cardsFor(base({ journeyAnswers: { utilities: { tariff_type: 'VARIABLE' } }, accounts: [acc({ category: 'electricity', monthly_amount_pence: 9000, contract_end_date: day(20) })] }))
  const ids = r.cards.filter((c) => c.category === 'utilities').map((c) => c.id)
  check('fix ending: shown', ids.includes('utilities:fix_ending'))
  check('fix ending: headline counts days', card(r, 'utilities:fix_ending')?.headline === 'Your fixed energy deal ends in 20 days')
  check('fix ending: ranks above variable vs fix', ids.indexOf('utilities:fix_ending') < ids.indexOf('utilities:variable_vs_fix'), ids.join(','))
  check('fix ending: deadline chip', card(r, 'utilities:fix_ending')?.context.some((x) => x.key === 'contract_deadline') ?? false)
}
// §12 Single occupier.
check('single occupier: discount shown', has(cardsFor(base({ profile: { ...base().profile, livingSituation: 'ALONE' } })), 'money:single_person_discount'))
// §12 Guest, postcode only: no L1+ findings, metrics needing L1+ say what fills them.
{
  const r = cardsFor(base({ identity: { kind: 'guest', guestSessionId: 'g' }, profile: null }))
  const money = r.byCategory.find((c) => c.category === 'money')!
  check('guest: money shows Coming soon', money.cards.every((c) => c.statusTag === 'coming_soon'))
  check('guest: unknown metrics are null with a field to fill', r.byCategory.every((c) => c.metrics.every((m) => m.value !== null || m.gapField !== null)))
  check('guest: no told-us drivers on any card', r.cards.every((c) => c.why.every((w) => w.source.name !== 'You told us')))
}
// One story per remaining category.
check('water: meter for fewer people than bedrooms', has(cardsFor(base({ loopAnswers: { water_meter_save: 'NO METER' }, storedFacts: [
  { category: 'water', field_key: 'occupants', value: 1, source_kind: 'told_us', source_name: 'You told us', source_url: null, as_of: '2026-10-01T00:00:00Z', confidence: 'medium', confidence_reason: null, tier: 2 },
  { category: 'water', field_key: 'bedrooms', value: 3, source_kind: 'public', source_name: 'Property record', source_url: null, as_of: '2026-10-01T00:00:00Z', confidence: 'high', confidence_reason: null, tier: 1 },
] })), 'water:meter'))
check('travel: car insurance renewal within 30 days', has(cardsFor(base({ accounts: [acc({ category: 'car_insurance', renewal_date: day(12) })] })), 'travel:insurance_renewal'))
check('food: surplus food for a household getting by', has(cardsFor(base({ profile: { ...base().profile, financialPressure: 'GETTING_BY' } })), 'food:surplus'))
check('shopping: student discount', has(cardsFor(base({ profile: { ...base().profile, employmentStatus: 'STUDENT' } })), 'shopping:student'))
check('waste: local reuse always offered', has(cardsFor(base()), 'waste:reuse'))
check('tech: streaming overlap', has(cardsFor(base({ accounts: [acc({ category: 'streaming', id: 's1', provider_name: 'Netflix', monthly_amount_pence: 1099 }), acc({ category: 'streaming', id: 's2', provider_name: 'Disney+', monthly_amount_pence: 899 })] })), 'tech:streaming_overlap'))
check('money: pension-age entitlements', has(cardsFor(base({ profile: { ...base().profile, age: 'RETIRED' } })), 'money:pension_age'))
check('lifestyle: pet insurance renewal', has(cardsFor(base({ journeyAnswers: { lifestyle: { pet_owner: 'DOG' } }, accounts: [acc({ category: 'pet_insurance', renewal_date: day(10) })] })), 'lifestyle:pet_renewal'))
check('home: quick wins in heating season', has(cardsFor(base()), 'home:quick_wins'))
check('home: no quick wins in July', !has(cardsFor(base(), new Date('2026-07-15T09:00:00Z')), 'home:quick_wins'))
check('solar: export tariff for panels without one', has(cardsFor(base({ loopAnswers: { solar_roof_fit: 'YES', solar_export_tariff: 'NONE' } })), 'solar:export'))
check('solar: no export card without panels', !has(cardsFor(base({ loopAnswers: { solar_roof_fit: 'NOT YET', solar_export_tariff: 'NONE' } })), 'solar:export'))
check('holidays: Coming soon until its questions exist', cardsFor(base()).byCategory.find((c) => c.category === 'holidays')!.cards[0].statusTag === 'coming_soon')
check('carbon: Coming soon (rolls up in Z8)', cardsFor(base()).byCategory.find((c) => c.category === 'carbon')!.cards[0].statusTag === 'coming_soon')

// ── 3. mechanical truth across 1,000 synthetic households ────────────────────────────────────

const synthetic = generateSyntheticHouseholds({ now })
let total = 0
const bad: string[] = []
for (const s of synthetic) {
  const r = cardsFor(s.inputs)
  for (const e of r.byCategory) if (e.issues.length) bad.push(...e.issues.map((i) => `${s.id} ${i}`))
  for (const c of r.cards) {
    total += 1
    if (!InsightCardSchema.safeParse(c).success) bad.push(`${s.id} ${c.id}: invalid`)
    if (c.keyMetric && !c.keyMetric.source.name) bad.push(`${s.id} ${c.id}: key metric without source`)
    if (c.saving && !c.saving.source) bad.push(`${s.id} ${c.id}: saving without source`)
    for (const o of c.options) if (o.actionId && !LIBRARY.has(o.actionId)) bad.push(`${s.id} ${c.id}: links unbuilt ${o.actionId}`)
  }
}
check(`every card for 1,000 households meets the contract (${total} cards)`, bad.length === 0, bad.slice(0, 5).join(' | '))
for (const story of ['broadband_out_of_contract', 'gym_rarely_used', 'fix_ending_soon', 'unmetered_water_few_occupants'] as const) {
  const expected = { broadband_out_of_contract: 'tech:broadband_out_of_contract', gym_rarely_used: 'lifestyle:low_use_membership', fix_ending_soon: 'utilities:fix_ending', unmetered_water_few_occupants: 'water:meter' }[story]
  const withStory = synthetic.filter((s) => s.stories.includes(story))
  const hit = withStory.filter((s) => has(cardsFor(s.inputs), expected)).length
  check(`synthetic story ${story} → ${expected} for every household`, hit === withStory.length, `${hit}/${withStory.length}`)
}

if (failures.length) {
  console.error(`[category-specs] FAIL ${failures.length}/${checks}`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`[category-specs] OK — ${checks} checks passed (${total} cards across ${synthetic.length} synthetic households)`)
