/**
 * CI gate — Zone recommendation card rules (no DB).
 * Run: npm run test:rec-cards
 */
import {
  BANK_CONNECT_CARD_ID,
  buildBankConnectCard,
  withConnectToSeeSaving,
  buildWhyYou,
  resolveRecCard,
  sortRecCards,
  SAMPLE_DATA_BADGE,
  type RecCardInput,
  type SavingSource,
  formatTypicalSaving,
} from '../lib/zone/recCard'
import {
  insightForLibraryCard,
  libraryCarbonTraceable,
  typicalSavingForLibraryCard,
} from '../lib/zone/recCardFromZone'
import { ZONE_ACTIONS } from '../lib/actions/actionLibrary'

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

// bank connect entry points.
const connect = buildBankConnectCard()
check('connect card copy', connect.whyYou === 'See your real savings, not estimates.')
check('connect card CTAs: Connect + Not now', connect.primaryCta.kind === 'connect_bank' && connect.primaryCta.label === 'Connect' && connect.secondaryCta?.kind === 'snooze' && connect.secondaryCta.label === 'Not now')
check('connect card is not a recommendation (opens nothing)', connect.openRef.type === 'bank' && connect.id === BANK_CONNECT_CARD_ID && connect.savingGbpPerYear === null)
const util = resolveRecCard({ ...base, category: 'utilities', id: 'u1', openRef: { type: 'journey', id: 'u1' } })!
const utilGated = withConnectToSeeSaving(util)
check('utilities card asks to connect', utilGated.primaryCta.kind === 'connect_bank' && utilGated.primaryCta.label === 'Connect to see your saving' && utilGated.dependsOnBank)
check('utilities card stays openable', utilGated.secondaryCta?.kind === 'open')
const homeCard = resolveRecCard(base)!
check('non-bank cards are untouched', withConnectToSeeSaving(homeCard) === homeCard)

// ── library cards: heading, impact, insight, action (2026-10-18 audit) ────────────────────

// Traceability: a library £ shows only when that exact amount is in the action's cited text.
for (const action of ZONE_ACTIONS) {
  const t = typicalSavingForLibraryCard(`journey-${action.id}`)
  if (!t) continue
  const figure = formatTypicalSaving(t).figure
  check(`${action.id}: shown figure ${figure} appears in its cited text`, `${action.detail} ${action.source}`.replace(/\s/g, '').includes(figure.replace(/\s/g, '')))
}
const whd = typicalSavingForLibraryCard('journey-warm-home-discount')
check('WHD: £150 a year, typical, cited to gov.uk', whd?.gbp === 150 && whd.phrase === 'typical' && whd.perYear && whd.source.name === 'gov.uk')
check('WHD formats as "Typically worth £150 a year"', whd != null && Object.values(formatTypicalSaving(whd)).join('') === 'Typically worth £150 a year')
const trust = typicalSavingForLibraryCard('journey-energy-trust-debt-grant')
check('debt grant reads "Worth up to £2,000" (no "a year" on a one-off)', trust != null && Object.values(formatTypicalSaving(trust)).join('') === 'Worth up to £2,000')
const owed = typicalSavingForLibraryCard('journey-benefits-entitlement-check')
check('benefits check reads as an average', owed?.phrase === 'average')
check('Council Tax Reduction £1,200 is not in its source, so no figure', typicalSavingForLibraryCard('journey-council-tax-reduction') === null)
check('rock- habits from the library resolve the same way', typicalSavingForLibraryCard('rock-warm-home-discount')?.gbp === 150)
check('non-library card has no typical saving', typicalSavingForLibraryCard('tip-123') === null)

// A typical figure never becomes the headline, and a verified figure always wins over it.
const typicalCard = resolveRecCard({ ...base, typicalSaving: whd })!
check('typical figure keeps the action as the headline', typicalCard.headline === 'Switch to a cheaper tariff' && typicalCard.savingGbpPerYear === null && typicalCard.typicalSaving?.gbp === 150)
const bothCard = resolveRecCard({ ...base, savingGbpPerYear: 300, savingSource: verified, typicalSaving: whd })!
check('verified figure wins over typical', bothCard.headline === 'Save £300 a year' && bothCard.typicalSaving === null)

// Insight: the key fact, not a restatement of the figure, and decimals stay intact.
check('WHD insight skips the "£150 off" restatement', /automatic on a qualifying benefit/.test(insightForLibraryCard('journey-warm-home-discount') ?? ''))
check('insight keeps £241.80 whole', /£241\.80/.test(insightForLibraryCard('journey-healthy-start-card') ?? ''))
check('insight keeps £12.50 whole', /£12\.50/.test(insightForLibraryCard('journey-social-broadband-tariff') ?? ''))

// Carbon follows the same rule: library kg estimates are not shown.
check('bleed radiators carbon estimate is not traceable', !libraryCarbonTraceable(ZONE_ACTIONS.find((a) => a.id === 'bleed-radiators')!))

// Library utilities cards keep their own action; the bank prompt is for bill offers.
const libUtil = resolveRecCard({ ...base, category: 'utilities', fromLibrary: true, typicalSaving: whd })!
check('library utilities card is not turned into "Connect to see your saving"', withConnectToSeeSaving(libUtil) === libUtil)

// whyYou names the fact that is about this kind of card.
const facts = { supplierName: 'Octopus Energy', homeType: 'HOUSE', powerType: 'GAS', household: 'FAMILY' }
check('water card speaks to the household, not the supplier', buildWhyYou('water', facts) === 'You live in a family home.')
check('utilities card names the supplier', buildWhyYou('utilities', facts) === "You're with Octopus Energy.")
check('home card speaks to how you heat', buildWhyYou('home', facts) === 'You heat a house with gas.')

if (failures.length) {
  console.error('[rec-cards] FAILED')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(`[rec-cards] OK — ${checks} checks passed`)
