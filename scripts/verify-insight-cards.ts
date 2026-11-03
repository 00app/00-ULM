/**
 * CI gate — InsightCard contract (Z4). No DB, no network.
 *
 *  1. Contract rules: £ without a source, realised without evidence, sample outside demo, half-built
 *     cards… are all rejected, and rejected cards come back as Coming soon.
 *  2. Snapshots: one canonical card per status tag, compared with scripts/fixtures/insight-cards.snap.json.
 *     After a deliberate contract change: npx tsx scripts/verify-insight-cards.ts --update
 *  3. Real cards: every action-library card, Rock habit, the bank connect card and the sample bank
 *     cards are lifted with `insightFromRecCard` and must meet the contract.
 *
 * Run: npm run test:insight-cards
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import {
  InsightCardSchema,
  comingSoonCard,
  insightFromRecCard,
  resolveInsightCard,
  type InsightCard,
} from '../lib/zone/insightCard'
import { buildBankConnectCard, resolveRecCard } from '../lib/zone/recCard'
import { habitToRecCard, insightForLibraryCard, typicalSavingForLibraryCard } from '../lib/zone/recCardFromZone'
import { ZONE_ACTIONS } from '../lib/actions/actionLibrary'
import { ROCK_HABITS } from '../lib/rock/habitsCatalog'
import { SampleBankProvider } from '../lib/bank'
import { analyseTransactions, SAMPLE_OFFER_BOOK } from '../lib/bank/analysis'
import { opportunityToRecCard } from '../lib/bank/cards'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean, detail?: string) {
  checks += 1
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}
const valid = (c: unknown) => InsightCardSchema.safeParse(c).success

// ── canonical cards, one per status ──────────────────────────────────────────────────────────

const src = { name: 'Ofcom', url: 'https://www.ofcom.org.uk/', asOf: '2026-09-30' }

const ready: InsightCard = {
  id: 'tech:broadband_out_of_contract',
  category: 'tech',
  statusTag: 'ready',
  label: 'TECH',
  headline: 'Your broadband deal ended 4 months ago',
  keyMetric: { label: 'Out of contract', value: 4, unit: 'count', source: { name: 'A bill you added', url: null, asOf: '2026-10-12' } },
  metrics: [
    { key: 'comms_month', label: 'Comms a month', value: 61, unit: 'gbp_month', source: { name: 'Bills you added', url: null, asOf: '2026-10-12' }, gapField: null },
    { key: 'months_out', label: 'Months out of contract', value: 4, unit: 'count', source: { name: 'A bill you added', url: null, asOf: '2026-10-12' }, gapField: null },
    { key: 'next_end', label: 'Next contract end', value: null, unit: 'date', source: null, gapField: 'mobile_contract_end' },
  ],
  why: [{ factKey: 'broadband_contract_end', label: 'Contract end', value: '12 June 2026', source: { name: 'A bill you added', url: null, asOf: '2026-10-12' } }],
  confidence: { level: 'medium', reason: 'Medium: your contract end date is from what you told us.' },
  saving: { kind: 'typical', gbpRange: { low: 108, high: 108 }, kgRange: null, source: src, method: null, evidence: null },
  effort: { minutes: 20, approvalTier: 2 },
  options: [
    { key: 'switch', label: 'Switch provider', actionId: 'out-of-contract-broadband', impact: { kind: 'typical', gbpRange: { low: 108, high: 108 }, kgRange: null, source: src }, effortMinutes: 20, approvalTier: 2, tradeOff: 'A new provider may need an engineer visit.', commission: { paid: true, note: 'We may be paid if you switch through this link.' } },
    { key: 'haggle', label: 'Haggle with your provider', actionId: 'out-of-contract-broadband', impact: { kind: null, gbpRange: null, kgRange: null, source: null }, effortMinutes: 15, approvalTier: 1, tradeOff: 'Savings depend on what they offer.', commission: { paid: false, note: null } },
    { key: 'remind', label: 'Stay, remind me in 30 days', actionId: null, impact: { kind: null, gbpRange: null, kgRange: null, source: null }, effortMinutes: 1, approvalTier: 1, tradeOff: 'You keep paying the out-of-contract price for now.', commission: { paid: false, note: null } },
  ],
  gaps: [{ questionId: 'tech_mobile_handset', field: 'mobile_handset_paid_off', whyWeAsk: 'A paid-off phone can move to SIM-only.' }],
  context: [{ key: 'contract_deadline', label: 'Contract ended', asOf: '2026-06-12' }],
  nextStep: { label: 'Compare broadband deals', optionKey: 'switch', approvalTier: 2 },
  related: ['tech:sim_only'],
  tier: 2,
}

const liveData: InsightCard = {
  ...ready,
  id: 'utilities:fix_ending',
  category: 'utilities',
  statusTag: 'live_data',
  label: 'UTILITIES',
  headline: 'Your fixed energy deal ends in 20 days',
  keyMetric: { label: 'Days until your fix ends', value: 20, unit: 'count', source: { name: 'Your bank', url: null, asOf: '2026-10-24' } },
  metrics: [],
  why: [{ factKey: 'fix_end_date', label: 'Fix ends', value: '14 November 2026', source: { name: 'Your bank', url: null, asOf: '2026-10-24' } }],
  confidence: { level: 'high', reason: 'From your bank payments.' },
  saving: null,
  options: [],
  gaps: [],
  context: [{ key: 'price_cap_window', label: 'Price cap changes 1 January', asOf: '2026-08-27' }],
  nextStep: { label: 'Compare fixed tariffs', optionKey: null, approvalTier: 2 },
  related: [],
  tier: 3,
}

const demo: InsightCard = {
  ...liveData,
  id: 'bank-energy-sample',
  statusTag: 'demo',
  headline: 'Save £240 a year',
  keyMetric: { label: 'Saving a year', value: 240, unit: 'gbp_year', source: { name: 'Sample bank data', url: null, asOf: '2026-10-01' } },
  saving: { kind: 'sample', gbpRange: { low: 240, high: 240 }, kgRange: null, source: { name: 'Sample bank data', url: null, asOf: '2026-10-01' }, method: null, evidence: null },
  confidence: { level: 'low', reason: 'Sample data, not your real payments.' },
}

const comingSoon = comingSoonCard({ id: 'lifestyle:low_use_membership', category: 'lifestyle', label: 'LIFESTYLE' })

const canonical: Record<string, InsightCard> = { live_data: liveData, ready, demo, coming_soon: comingSoon }

for (const [status, card] of Object.entries(canonical)) {
  const r = InsightCardSchema.safeParse(card)
  check(`canonical ${status} card is valid`, r.success, r.success ? undefined : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  check(`canonical ${status} card has status ${status}`, card.statusTag === status)
}

// ── contract rules ───────────────────────────────────────────────────────────────────────────

const without = <K extends keyof InsightCard>(card: InsightCard, patch: Pick<InsightCard, K> | Record<string, unknown>) =>
  ({ ...card, ...patch }) as unknown as InsightCard

check('rejects £ without source (saving)', !valid(without(ready, { saving: { ...ready.saving!, source: null } })))
check('rejects £ without source (key metric)', !valid(without(ready, { keyMetric: { ...ready.keyMetric!, source: null } })))
check('rejects £ with an unnamed source', !valid(without(ready, { keyMetric: { ...ready.keyMetric!, source: { name: ' ', url: null, asOf: '2026-10-01' } } })))
check('rejects a source with no as-of', !valid(without(ready, { keyMetric: { ...ready.keyMetric!, source: { name: 'Ofcom', url: null } } })))
check('rejects a non-https source link', !valid(without(ready, { keyMetric: { ...ready.keyMetric!, source: { ...src, url: 'http://example.com' } } })))
check('rejects a metric value without source', !valid(without(ready, { metrics: ready.metrics.map((m, i) => (i === 0 ? { ...m, source: null } : m)) })))
check('rejects an unknown metric with no field to fill it', !valid(without(ready, { metrics: ready.metrics.map((m, i) => (i === 2 ? { ...m, gapField: null } : m)) })))
check('rejects an option £ without source', !valid(without(ready, { options: ready.options.map((o, i) => (i === 0 ? { ...o, impact: { ...o.impact, source: null } } : o)) })))
check('rejects a paid option that does not say so', !valid(without(ready, { options: ready.options.map((o, i) => (i === 0 ? { ...o, commission: { paid: true, note: null } } : o)) })))
check('rejects an option without a trade-off', !valid(without(ready, { options: ready.options.map((o, i) => (i === 1 ? { ...o, tradeOff: '' } : o)) })))
check('rejects realised without evidence', !valid(without(ready, { saving: { ...ready.saving!, kind: 'realised' } })))
check(
  'accepts realised with evidence',
  valid(without(ready, { saving: { ...ready.saving!, kind: 'realised', evidence: { evidenceId: 'ev-1', confirmedOn: '2026-10-20' } } }))
)
check('rejects evidence on a typical saving', !valid(without(ready, { saving: { ...ready.saving!, evidence: { evidenceId: 'ev-1', confirmedOn: '2026-10-20' } } })))
check('rejects estimated without a method', !valid(without(ready, { saving: { ...ready.saving!, kind: 'estimated' } })))
check('rejects a saving with no range', !valid(without(ready, { saving: { ...ready.saving!, gbpRange: null } })))
check('rejects a range with low above high', !valid(without(ready, { saving: { ...ready.saving!, gbpRange: { low: 200, high: 100 } } })))
check('rejects sample outside demo', !valid(without(ready, { saving: { ...demo.saving! }, confidence: demo.confidence })))
check('rejects sample with high confidence', !valid(without(demo, { confidence: { level: 'high', reason: 'x' } })))
check('rejects demo without a sample saving', !valid(without(demo, { saving: null })))
check('rejects live data with no figure', !valid(without(liveData, { keyMetric: null, saving: null })))
check('rejects Coming soon with a figure', !valid(without(comingSoon, { keyMetric: ready.keyMetric })))
check('rejects Coming soon with options', !valid(without(comingSoon, { options: ready.options })))
check('rejects 1 option', !valid(without(ready, { options: ready.options.slice(0, 1), nextStep: null })))
check('rejects 4 options', !valid(without(ready, { options: [...ready.options, { ...ready.options[2], key: 'x' }] })))
check('rejects 2 metrics', !valid(without(ready, { metrics: ready.metrics.slice(0, 2) })))
check('rejects 5 metrics', !valid(without(ready, { metrics: [...ready.metrics, { ...ready.metrics[0], key: 'a' }, { ...ready.metrics[0], key: 'b' }] })))
check('rejects 3 related cards', !valid(without(ready, { related: ['a', 'b', 'c'] })))
check('rejects a card related to itself', !valid(without(ready, { related: [ready.id] })))
check('rejects a next step to a missing option', !valid(without(ready, { nextStep: { label: 'Go', optionKey: 'nope', approvalTier: 1 } })))
check('rejects approval tier 4', !valid(without(ready, { effort: { minutes: 5, approvalTier: 4 } })))
check('rejects an exclamation mark', !valid(without(ready, { headline: 'Save now!' })))
check('rejects a trailing ellipsis', !valid(without(ready, { headline: 'Your broadband deal…' })))
check('rejects a confidence with no reason', !valid(without(ready, { confidence: { level: 'medium', reason: '' } })))
check('accepts lifestyle as a category', valid(without(ready, { category: 'lifestyle' })))
check('rejects an unknown category', !valid(without(ready, { category: 'pets' })))

// ── Coming soon fallback ─────────────────────────────────────────────────────────────────────

const bad = resolveInsightCard(without(ready, { saving: { ...ready.saving!, source: null } }))
check('a failing card resolves to Coming soon', !bad.ok && bad.card.statusTag === 'coming_soon')
check('Coming soon keeps the id, category and label', bad.card.id === ready.id && bad.card.category === 'tech' && bad.card.label === 'TECH')
check('Coming soon shows no figure', bad.card.keyMetric === null && bad.card.saving === null)
check('the failure says why', bad.issues.some((i) => /source/.test(i)), bad.issues.join('; '))
check('garbage resolves to a valid Coming soon card', valid(resolveInsightCard({ nonsense: true }).card))
check('a good card resolves as itself', resolveInsightCard(ready).ok && resolveInsightCard(ready).card.id === ready.id)

// ── snapshots ────────────────────────────────────────────────────────────────────────────────

const snapPath = path.join(__dirname, 'fixtures', 'insight-cards.snap.json')
const snapshot = JSON.stringify(
  Object.fromEntries(Object.entries(canonical).map(([k, v]) => [k, InsightCardSchema.parse(v)])),
  null,
  2
)
if (process.argv.includes('--update')) {
  writeFileSync(snapPath, `${snapshot}\n`)
  console.log(`[insight-cards] snapshot written: ${path.relative(process.cwd(), snapPath)}`)
} else {
  let stored = ''
  try {
    stored = readFileSync(snapPath, 'utf8').trim()
  } catch {
    stored = ''
  }
  check('snapshot file exists (run with --update to create it)', stored.length > 0)
  if (stored) {
    const want = JSON.parse(stored) as Record<string, unknown>
    const got = JSON.parse(snapshot) as Record<string, unknown>
    for (const status of Object.keys(canonical)) {
      check(`snapshot matches for ${status}`, JSON.stringify(want[status]) === JSON.stringify(got[status]))
    }
  }
}

// ── today's real cards meet the contract ─────────────────────────────────────────────────────

const facts = { place: 'Testville', homeType: 'HOUSE', powerType: 'GAS', household: 'COUPLE', transport: 'CAR', supplierName: 'Octopus Energy' }
const lifted: Array<{ id: string; card: InsightCard; ok: boolean; issues: string[] }> = []

for (const a of ZONE_ACTIONS) {
  const id = `journey-${a.id}`
  const rec = resolveRecCard({
    id,
    size: 'large',
    category: a.bucket,
    label: a.bucket.toUpperCase(),
    actionWording: a.action,
    typicalSaving: typicalSavingForLibraryCard(id),
    insight: insightForLibraryCard(id),
    fromLibrary: true,
    whyYou: 'You live with a partner.',
    openRef: { type: 'journey', id },
  })
  if (!rec) continue
  const r = insightFromRecCard(rec, { profileAsOf: '2026-09-01' })
  lifted.push({ id, ...r })
  const t = typicalSavingForLibraryCard(id)
  if (t) {
    check(`${id}: typical £ kept with its source`, r.card.saving?.kind === 'typical' && r.card.saving.gbpRange?.low === t.gbp && r.card.keyMetric?.source.asOf === a.verifiedOn)
  } else {
    check(`${id}: no traceable £ → no figure`, r.card.saving === null && r.card.keyMetric === null)
  }
}
for (const h of ROCK_HABITS) {
  const rec = habitToRecCard(h, `rock-${h.slug}`, { facts })
  if (!rec) continue
  lifted.push({ id: rec.id, ...insightFromRecCard(rec) })
}
lifted.push({ id: 'bank-connect', ...insightFromRecCard(buildBankConnectCard()) })

async function main() {
  // Sample bank cards: badged £ kept as demo when the sample date is passed, dropped when it is not.
  const now = new Date('2026-10-25T09:00:00Z')
  const provider = new SampleBankProvider({ now })
  await provider.connect()
  const txs = await provider.getTransactions({ from: new Date('2026-01-01'), to: now })
  const analysis = analyseTransactions(txs, { offers: SAMPLE_OFFER_BOOK, source: 'sample' })
  let bankCards = 0
  for (const o of analysis.opportunities) {
    const rec = opportunityToRecCard(o, { openJourneyId: 'journey-utilities', records: {}, postcode: 'ZZ99 1AA' })
    if (!rec) continue
    bankCards += 1
    const withDate = insightFromRecCard(rec, { sampleAsOf: '2026-10-25' })
    lifted.push({ id: rec.id, ...withDate })
    check(`${rec.id}: sample £ is demo, low confidence`, withDate.card.statusTag === 'demo' && withDate.card.saving?.kind === 'sample' && withDate.card.confidence.level === 'low')
    const noDate = insightFromRecCard(rec)
    check(`${rec.id}: sample £ without a date is dropped, not shown undated`, noDate.ok && noDate.card.saving === null && noDate.card.keyMetric === null)
  }
  check('sample bank data produces cards to check', bankCards > 0, String(bankCards))

  const failedLift = lifted.filter((l) => !l.ok)
  check(
    `every real card meets the contract (${lifted.length} cards)`,
    failedLift.length === 0,
    failedLift.slice(0, 5).map((f) => `${f.id}: ${f.issues.join('; ')}`).join(' | ')
  )
  check('library cards were lifted', lifted.filter((l) => l.id.startsWith('journey-')).length === ZONE_ACTIONS.length)
  check('no real card is Coming soon', lifted.every((l) => l.card.statusTag !== 'coming_soon'))

  if (failures.length) {
    console.error(`[insight-cards] FAIL ${failures.length}/${checks}`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`[insight-cards] OK — ${checks} checks passed (${lifted.length} real cards lifted)`)
}

void main()
