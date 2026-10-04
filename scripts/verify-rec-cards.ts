/**
 * CI gate — Zone recommendation card rules (no DB).
 * Run: npm run test:rec-cards
 */
import {
  buildWhyYou,
  resolveRecCard,
  sortRecCards,
  SAMPLE_DATA_BADGE,
  type RecCardInput,
  type SavingSource,
} from '../lib/zone/recCard'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean) {
  checks += 1
  if (!cond) failures.push(name)
}

const base: RecCardInput = {
  id: 'c1',
  size: 'large',
  category: 'home',
  label: 'HOME',
  actionWording: 'switch to a cheaper tariff',
  whyYou: "You're with British Gas.",
  openRef: { type: 'journey', id: 'journey-home' },
}
const verified: SavingSource = { kind: 'verified', name: 'Ofgem', date: '2026-09' }
const sample: SavingSource = { kind: 'sample', name: 'Sample bank data' }

// whyYou rule: no why, no card.
check('null whyYou -> no card', resolveRecCard({ ...base, whyYou: null }) === null)
check('blank whyYou -> no card', resolveRecCard({ ...base, whyYou: '   ' }) === null)
check('with whyYou -> card', resolveRecCard(base) !== null)

// source rule: no source, no £.
const noSource = resolveRecCard({ ...base, savingGbpPerYear: 420 })
check('£ without source is dropped', noSource?.savingGbpPerYear === null)
check('£ without source -> action wording headline', noSource?.headline === 'Switch to a cheaper tariff')
check('£ without source keeps no source ref', noSource?.savingSource === null)

const withSource = resolveRecCard({ ...base, savingGbpPerYear: 420, savingSource: verified })
check('£ with source is kept', withSource?.savingGbpPerYear === 420)
check('£ with source -> £ headline', withSource?.headline === 'Save £420 a year')
check('£ with source keeps source ref', withSource?.savingSource?.name === 'Ofgem')
check('verified £ has no sample badge', withSource?.badge === undefined)

const withBlankSource = resolveRecCard({
  ...base,
  savingGbpPerYear: 420,
  savingSource: { kind: 'verified', name: '  ' },
})
check('blank source name counts as no source', withBlankSource?.savingGbpPerYear === null)

// zero / negative / NaN never produce a £.
for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
  const c = resolveRecCard({ ...base, savingGbpPerYear: bad, savingSource: verified })
  check(`£ ${String(bad)} is not shown`, c?.savingGbpPerYear === null || (bad === Number.POSITIVE_INFINITY && c?.savingGbpPerYear === null))
}

// sample badge.
const sampleCard = resolveRecCard({ ...base, savingGbpPerYear: 310, savingSource: sample })
check('sample-sourced £ carries the Sample data badge', sampleCard?.badge === SAMPLE_DATA_BADGE)
check('sample badge only when £ is shown', resolveRecCard({ ...base, savingSource: sample })?.badge === undefined)

// defaults.
check('default primary CTA is verb-led open', withSource?.primaryCta.kind === 'open' && /^[A-Z]/.test(withSource.primaryCta.label))

// whyYou builder.
check('supplier -> why', buildWhyYou('home', { supplierName: 'British Gas' }) === "You're with British Gas.")
check(
  'bank spend + supplier -> why with £/mo',
  buildWhyYou('utilities', { bankSupplierName: 'British Gas', monthlyEnergySpendGbp: 148 }) ===
    'You pay £148/mo to British Gas.'
)
check('home + power -> why', buildWhyYou('home', { homeType: 'FLAT', powerType: 'GAS' }) === 'You heat a flat with gas.')
check('transport -> why', buildWhyYou('travel', { transport: 'CAR' }) === 'You get around by car.')
check('household -> why for food', buildWhyYou('food', { household: 'ALONE' }) === 'You live alone.')
check('place fallback', buildWhyYou('shopping', { place: 'Manchester' }) === 'Based on where you live, Manchester.')
check('no facts -> null', buildWhyYou('home', {}) === null)
check('travel with only household and no place -> null', buildWhyYou('travel', { household: 'ALONE' }) === null)

// sort: verified £ desc, then unverified in original order (stable).
const items = [
  { id: 'a', savingGbpPerYear: null },
  { id: 'b', savingGbpPerYear: 100 },
  { id: 'c', savingGbpPerYear: null },
  { id: 'd', savingGbpPerYear: 300 },
  { id: 'e', savingGbpPerYear: 100 },
]
check(
  'sort puts verified £ desc then unverified in existing order',
  sortRecCards(items).map((i) => i.id).join('') === 'dbeac'
)

if (failures.length) {
  console.error('[rec-cards] FAILED')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(`[rec-cards] OK — ${checks} checks passed`)
