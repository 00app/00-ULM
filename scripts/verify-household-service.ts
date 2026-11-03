/**
 * Household data service (Z3): every fact carries a source and an as-of, unknown stays null, the
 * synthetic dataset is stable and covers every story, and peers under five are never compared.
 * Synthetic data only — no database, no network.
 */

import {
  ALL_FACT_KEYS,
  CATEGORY_FACTS,
  HOUSEHOLD_FACT_CATEGORIES,
  MIN_PEER_GROUP,
  SYNTHETIC_STORIES,
  buildHousehold,
  daysUntil,
  generateSyntheticHouseholds,
  getCategoryFacts,
  getContracts,
  getEligibility,
  getFact,
  getGaps,
  getPeerComparison,
  getSubscriptions,
  isSyntheticHouseholdsEnabled,
  knowledgeOf,
  type Household,
  type HouseholdInputs,
} from '@/lib/household'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
const assert = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail })

const now = new Date('2026-10-25T09:00:00Z')
const synthetic = generateSyntheticHouseholds({ now })
const built = synthetic.map((s) => ({ ...s, h: buildHousehold(s.inputs, now) }))

// --- Synthetic dataset ---------------------------------------------------------------------
assert('1,000 synthetic households', synthetic.length === 1000, String(synthetic.length))
assert('ids are unique', new Set(synthetic.map((s) => s.id)).size === synthetic.length)
assert(
  'deterministic for the same seed and date',
  JSON.stringify(generateSyntheticHouseholds({ now, count: 50 })) === JSON.stringify(generateSyntheticHouseholds({ now, count: 50 }))
)
assert('every postcode is in the fictitious ZZ99 area', synthetic.every((s) => /^ZZ99 \d[A-Z]{2}$/.test(s.inputs.postcode ?? '')))
for (const story of SYNTHETIC_STORIES) {
  const n = synthetic.filter((s) => s.stories.includes(story)).length
  assert(`story "${story}" appears at least 50 times`, n >= 50, String(n))
}
assert('off in production by default', !isSyntheticHouseholdsEnabled({ NODE_ENV: 'production' }))
assert('on in production only when asked', isSyntheticHouseholdsEnabled({ NODE_ENV: 'production', HOUSEHOLD_SYNTHETIC: '1' }))
assert('on in development', isSyntheticHouseholdsEnabled({ NODE_ENV: 'development' }))

// --- Every record has a source and an as-of ------------------------------------------------
let factCount = 0
const badFacts: string[] = []
for (const { id, h } of built) {
  for (const f of Object.values(h.facts)) {
    factCount++
    const ok =
      f.source.name.trim().length > 0 &&
      Number.isFinite(Date.parse(f.asOf)) &&
      ['high', 'medium', 'low'].includes(f.confidence) &&
      f.confidenceReason.trim().length > 0 &&
      [1, 2, 3].includes(f.tier) &&
      f.value !== null &&
      f.value !== undefined &&
      f.value !== ''
    if (!ok) badFacts.push(`${id}:${f.key}`)
  }
}
assert('synthetic households produce facts', factCount > 10_000, String(factCount))
assert('every fact has source, as-of, confidence, reason and tier', badFacts.length === 0, badFacts.slice(0, 5).join(', '))
for (const { h } of built.slice(0, 50)) {
  for (const f of Object.values(h.facts)) {
    if (f.source.url !== null && !f.source.url.startsWith('https://')) badFacts.push(f.key)
  }
}
assert('source URLs are https or null', badFacts.length === 0)

// --- Missing is null, never 0 --------------------------------------------------------------
const empty: HouseholdInputs = {
  identity: { kind: 'guest', guestSessionId: 'test-guest' },
  postcode: 'ZZ99 1AA',
  profile: null,
  profileAsOf: null,
  journeyAnswers: null,
  journeyAnswersAsOf: null,
  loopAnswers: null,
  loopAnswersAsOf: null,
  property: null,
  accounts: [],
  bank: null,
  storedFacts: [],
}
const blank = buildHousehold(empty, now)
assert('an empty household has no facts', Object.keys(blank.facts).length === 0)
assert('an unknown fact is null', ALL_FACT_KEYS.every((k) => getFact(blank, k) === null))
assert(
  'category facts list unknowns as null, not 0',
  HOUSEHOLD_FACT_CATEGORIES.every((c) => getCategoryFacts(blank, c).facts.every((x) => x.fact === null))
)
assert('an empty household knows nothing', HOUSEHOLD_FACT_CATEGORIES.every((c) => knowledgeOf(blank, c).score === 0))
assert('a priced account with no price stays unknown', (() => {
  const h = buildHousehold(
    {
      ...empty,
      identity: { kind: 'synthetic', syntheticId: 't' },
      accounts: [
        { id: 'a', category: 'broadband', provider_name: 'BT', monthly_amount_pence: null, renewal_date: null, contract_end_date: null, source: 'manual', status: 'active', updated_at: now.toISOString() },
      ],
    },
    now
  )
  return getFact(h, 'broadband_monthly_price') === null && getFact(h, 'broadband_provider')?.value === 'BT'
})())

// --- Guests: no accounts or bank -----------------------------------------------------------
const sampleAccounts = synthetic.find((s) => s.inputs.accounts.length > 0)!.inputs
const asGuest = buildHousehold({ ...sampleAccounts, identity: { kind: 'guest', guestSessionId: 'g' } }, now)
assert('guests never get bills or contracts', asGuest.accounts.length === 0 && Object.values(asGuest.facts).every((f) => f.level !== 'L3' && f.level !== 'L4'))

// --- Stories produce the facts the Z6 rules will read --------------------------------------
const withStory = (story: (typeof SYNTHETIC_STORIES)[number]) => built.filter((b) => b.stories.includes(story))

assert('broadband out of contract: end date has passed', withStory('broadband_out_of_contract').every(({ h }) => (daysUntil(getFact(h, 'broadband_contract_end')?.value as string, now) ?? 0) < 0))
assert('broadband out of contract: listed as a contract', withStory('broadband_out_of_contract').every(({ h }) => getContracts(h).some((c) => c.key === 'broadband')))
assert(
  'broadband from the bank is high confidence; typed is medium',
  withStory('broadband_out_of_contract').every(({ h }) => {
    const f = getFact(h, 'broadband_contract_end')!
    return f.source.kind === 'bank' ? f.confidence === 'high' && f.tier === 3 : f.confidence === 'medium' && f.tier === 2
  })
)
assert('unused subscription: two or more streaming services', withStory('unused_subscription').every(({ h }) => getSubscriptions(h).filter((s) => s.kind === 'streaming').length >= 2))
assert(
  'gym rarely used: cost per visit can be worked out',
  withStory('gym_rarely_used').every(({ h }) =>
    getSubscriptions(h).some((s) => s.kind === 'membership' && s.monthlyPricePence !== null && s.usesPerMonth !== null && s.usesPerMonth <= 1)
  )
)
assert(
  'insurance renewal: due within 30 days',
  withStory('insurance_renewal_up').every(({ h }) =>
    getContracts(h).some((c) => /insurance/.test(c.key) && (daysUntil(c.renewalDate, now) ?? 99) <= 30)
  )
)
assert(
  'EPC D grant story: owner, band D, gas, BUS eligible',
  withStory('epc_d_grant_eligible').every(({ h }) =>
    getFact(h, 'tenure')?.value === 'OWNER' &&
    getFact(h, 'epc_band')?.value === 'D' &&
    getFact(h, 'epc_band')?.source.name === 'EPC register' &&
    getFact(h, 'power_type')?.value === 'GAS' &&
    getEligibility(h, { now, month: 10 }).some((e) => e.action.id === 'boiler-upgrade-scheme' && e.confirmed)
  )
)
assert('fix ending soon: fix ends within 45 days', withStory('fix_ending_soon').every(({ h }) => {
  const d = daysUntil(getFact(h, 'fix_end_date')?.value as string, now)
  return d !== null && d >= 0 && d <= 45
}))
assert(
  'unmetered water: fewer people than bedrooms, no meter',
  withStory('unmetered_water_few_occupants').every(({ h }) =>
    (getFact(h, 'occupants')?.value as number) < (getFact(h, 'bedrooms')?.value as number) && getFact(h, 'metered')?.value === 'NO METER'
  )
)
assert(
  'single occupier is worked out and unlocks the single person discount',
  built
    .filter(({ h }) => getFact(h, 'single_occupier')?.value === true)
    .every(({ h }) => getEligibility(h, { now, month: 10 }).some((e) => e.action.id === 'single-person-council-tax'))
)

// --- Precedence: higher tier wins, then newer -----------------------------------------------
const precedence = buildHousehold(
  {
    ...empty,
    identity: { kind: 'synthetic', syntheticId: 'p' },
    loopAnswers: { tech_broadband_end: '2027-01-01' },
    loopAnswersAsOf: '2026-10-20T00:00:00Z',
    accounts: [
      { id: 'b', category: 'broadband', provider_name: 'Sky', monthly_amount_pence: 3000, renewal_date: null, contract_end_date: '2026-06-01', source: 'bank', status: 'active', updated_at: '2026-01-01T00:00:00Z' },
    ],
  },
  now
)
assert('bank evidence beats a newer told-us answer', getFact(precedence, 'broadband_contract_end')?.value === '2026-06-01')
const told = buildHousehold(
  {
    ...empty,
    identity: { kind: 'synthetic', syntheticId: 'q' },
    profile: { homeOwnership: 'OWNER' },
    profileAsOf: '2026-01-01T00:00:00Z',
    storedFacts: [
      { category: 'home', field_key: 'tenure', value: 'RENTER', source_kind: 'told_us', source_name: 'You told us', source_url: null, as_of: '2026-10-01T00:00:00Z', confidence: 'medium', confidence_reason: null, tier: 2 },
    ],
  },
  now
)
assert('a newer correction beats the old answer at the same tier', getFact(told, 'tenure')?.value === 'RENTER')
assert('ended accounts are ignored', buildHousehold({
  ...empty,
  identity: { kind: 'synthetic', syntheticId: 'e' },
  accounts: [{ id: 'x', category: 'mobile', provider_name: 'EE', monthly_amount_pence: 1000, renewal_date: null, contract_end_date: '2027-01-01', source: 'manual', status: 'ended', updated_at: now.toISOString() }],
}, now).facts.mobile_monthly_price === undefined)

// --- Public data: EPC confidence follows the match ------------------------------------------
const epcOnly = (addressMatched: boolean, isStale: boolean) =>
  buildHousehold(
    {
      ...empty,
      property: {
        epc: { found: true, postcode: 'ZZ991AA', currentEnergyRating: 'E', currentThermalEfficiencyMultiplier: 1, description: 't', lodgementDate: '2020-01-01', addressMatched, isStale },
        enrichedAt: now.toISOString(),
        confidence: 'POSTCODE_ONLY',
      },
    },
    now
  ).facts.epc_band
assert('EPC matched to the address is high', epcOnly(true, false)?.confidence === 'high')
assert('stale EPC is medium', epcOnly(true, true)?.confidence === 'medium')
assert('postcode-only EPC is low', epcOnly(false, false)?.confidence === 'low')
assert('EPC as-of is the lodgement date', epcOnly(true, false)?.asOf === '2020-01-01')
assert('guests still get public facts', epcOnly(true, false)?.tier === 1)

// --- Gaps never ask for public data ---------------------------------------------------------
assert('gaps never include L0 facts', HOUSEHOLD_FACT_CATEGORIES.every((c) => getGaps(blank, c).every((g) => g.level !== 'L0')))
assert('gaps are ordered by weight', HOUSEHOLD_FACT_CATEGORIES.every((c) => {
  const w = getGaps(blank, c).map((g) => g.weight)
  return w.every((x, i) => i === 0 || x <= w[i - 1])
}))
assert('a known fact is not a gap', built.slice(0, 100).every(({ h }) => HOUSEHOLD_FACT_CATEGORIES.every((c) => getGaps(h, c).every((g) => !h.facts[g.key]))))
assert('knowledge state is bounded', built.slice(0, 100).every(({ h }) => HOUSEHOLD_FACT_CATEGORIES.every((c) => {
  const k = knowledgeOf(h, c)
  return k.score >= 0 && k.score <= 1 && k.known <= k.total
})))
assert('registry weights are 1 to 5', Object.values(CATEGORY_FACTS).flat().every((f) => f.weight >= 1 && f.weight <= 5))

// --- Peer comparison: nothing under five ---------------------------------------------------
const peerPool: Household[] = built.map((b) => b.h)
const withPrice = peerPool.filter((h) => typeof h.facts.broadband_monthly_price?.value === 'number')
const me = withPrice[0]
assert('peer comparison works with a large group', (getPeerComparison(me, 'broadband_monthly_price', peerPool)?.peers ?? 0) >= MIN_PEER_GROUP)
assert('no comparison with four peers', getPeerComparison(me, 'broadband_monthly_price', withPrice.slice(1, 5)) === null)
assert('comparison with five peers', getPeerComparison(me, 'broadband_monthly_price', withPrice.slice(1, 6))?.peers === 5)
assert('you are never your own peer', getPeerComparison(me, 'broadband_monthly_price', [me, ...withPrice.slice(1, 5)]) === null)
assert('no comparison for an unknown fact', getPeerComparison(me, 'no_such_fact', peerPool) === null)
const cmp = getPeerComparison(me, 'broadband_monthly_price', peerPool)!
assert('quartiles are ordered', cmp.p25 <= cmp.median && cmp.median <= cmp.p75)

const failed = checks.filter((c) => !c.pass)
for (const c of failed) console.error(`✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
if (failed.length > 0) {
  console.error(`[household-service] FAIL — ${failed.length} of ${checks.length} checks failed`)
  process.exit(1)
}
console.log(`[household-service] OK — ${checks.length} checks passed (${factCount} facts across ${built.length} synthetic households)`)
