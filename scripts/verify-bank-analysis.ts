/**
 * CI gate — bank data layer: sample provider, recurring-payment detection, price-rise detection,
 * saving vs best offer. No network, no DB. Run: npm run test:bank
 */
import { SampleBankProvider, LiveBankProvider, getBankProvider } from '../lib/bank'
import {
  analyseTransactions,
  computeOpportunity,
  detectPriceRise,
  detectRecurring,
  merchantKey,
  SAMPLE_OFFER_BOOK,
} from '../lib/bank/analysis'
import type { BankTransaction } from '../lib/bank/types'
import {
  isBankCardSnoozed,
  parseBankState,
  shouldShowBankConnectCard,
  snoozeUntil,
} from '../lib/bank/connectionState'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean) {
  checks += 1
  if (!cond) failures.push(name)
}

function tx(date: string, pounds: number, description: string, i = 0): BankTransaction {
  return { id: `t${date}${i}`, accountId: 'a', date, amountPence: Math.round(-pounds * 100), description }
}

async function main() {
  // ── sample provider ─────────────────────────────────────────────────────────────────────────
  const now = new Date(Date.UTC(2026, 8, 30)) // 30 Sep 2026, fixed so the test is stable
  const p = new SampleBankProvider({ now })
  let threw = false
  try {
    await p.getAccounts()
  } catch {
    threw = true
  }
  check('provider refuses data before connect()', threw)
  const conn = await p.connect()
  check('sample connection source is sample', conn.source === 'sample')
  check('one sample account', (await p.getAccounts()).length === 1)

  const from = new Date(Date.UTC(2025, 9, 1))
  const txs = await p.getTransactions({ from, to: now })
  check('12 months of history', txs[0].date <= '2025-10-31' && txs[txs.length - 1].date >= '2026-09-01')
  check('integer pence amounts', txs.every((t) => Number.isInteger(t.amountPence)))
  const again = await new SampleBankProvider({ now }).connect().then(async () => {
    const q = new SampleBankProvider({ now })
    await q.connect()
    return q.getTransactions({ from, to: now })
  })
  check('sample data is deterministic', JSON.stringify(again) === JSON.stringify(txs))
  check('range filter works', (await p.getTransactions({ from: new Date(Date.UTC(2026, 8, 1)), to: now })).every((t) => t.date >= '2026-09-01'))
  check('no future-dated rows', txs.every((t) => t.date <= '2026-09-30'))

  // ── recurring detection ─────────────────────────────────────────────────────────────────────
  const recurring = detectRecurring(txs)
  const names = recurring.map((r) => r.displayName).sort()
  const expected = ['Admiral', 'Amazon Prime', 'Aviva', 'British Gas', 'EE', 'Gym', 'Netflix', 'Sky', 'Spotify']
  check(`detects exactly the 9 recurring series (got ${names.join(',')})`, JSON.stringify(names) === JSON.stringify(expected))
  check('groceries/transport/coffee are not recurring', !recurring.some((r) => /^(TESCO|SAINSBURYS|TFL|PRET|COSTA|BOOTS|AMAZON MKTPLACE)\b/.test(r.merchantKey)))
  const cat = (n: string) => recurring.find((r) => r.displayName === n)?.category
  check('categories: energy', cat('British Gas') === 'energy')
  check('categories: broadband', cat('Sky') === 'broadband')
  check('categories: mobile', cat('EE') === 'mobile')
  check('categories: insurance', cat('Admiral') === 'insurance' && cat('Aviva') === 'insurance')
  check('categories: subscriptions', cat('Netflix') === 'subscription' && cat('Spotify') === 'subscription')

  // ── price-rise detection ────────────────────────────────────────────────────────────────────
  const bg = recurring.find((r) => r.displayName === 'British Gas')!
  check('British Gas current level is £148/mo', bg.monthlyAmountPence === 14800)
  check('British Gas price rise detected', bg.priceRise !== null)
  check('rise is £118 -> £148', bg.priceRise?.fromPence === 11800 && bg.priceRise?.toPence === 14800)
  check('rise is 25.4%', bg.priceRise?.pct === 25.4)
  check('exactly one series has a price rise', recurring.filter((r) => r.priceRise).length === 1)

  const series = (arr: number[]) => arr.map((pence, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-10`, pence }))
  check('2% change is not a rise', detectPriceRise(series([5000, 5000, 5100, 5100, 5100])) === null)
  check('one-off spike that drops back is not a rise', detectPriceRise(series([5000, 5000, 7000, 5000, 5000])) === null)
  check('step up that holds is a rise', detectPriceRise(series([5000, 5000, 5000, 6000, 6000]))?.toPence === 6000)
  check('rise needs at least 3 payments', detectPriceRise(series([5000, 6500])) === null)

  // ── cadence rules ───────────────────────────────────────────────────────────────────────────
  const irregular = [tx('2026-01-03', 20, 'WEIRD SHOP'), tx('2026-01-09', 20, 'WEIRD SHOP'), tx('2026-03-30', 20, 'WEIRD SHOP')]
  check('irregular payments are not recurring', detectRecurring(irregular).length === 0)
  const two = [tx('2026-01-03', 20, 'WEIRD SHOP'), tx('2026-02-03', 20, 'WEIRD SHOP')]
  check('two payments are not enough', detectRecurring(two).length === 0)
  const monthly = [tx('2026-01-03', 20, 'FOO GYM'), tx('2026-02-03', 20, 'FOO GYM'), tx('2026-03-04', 20, 'FOO GYM')]
  check('three monthly payments are recurring', detectRecurring(monthly).length === 1)
  const varying = [tx('2026-01-03', 20, 'VARY CO'), tx('2026-02-03', 90, 'VARY CO'), tx('2026-03-04', 15, 'VARY CO')]
  check('wildly varying amounts are not recurring', detectRecurring(varying).length === 0)
  check('credits are ignored', detectRecurring(txs.filter((t) => t.amountPence > 0)).length === 0)
  check('merchant key strips refs and digits', merchantKey('SPOTIFY P1A2B3') === 'SPOTIFY' && merchantKey('BRITISH GAS DD REF 4821') === 'BRITISH GAS')

  // ── saving vs best offer ────────────────────────────────────────────────────────────────────
  const analysis = analyseTransactions(txs, { offers: SAMPLE_OFFER_BOOK, source: 'sample' })
  check('analysis source is sample', analysis.source === 'sample')
  const energy = analysis.opportunities.find((o) => o.category === 'energy')!
  check('energy annual spend is £1,776', energy.annualGbp === 1776)
  check('energy saving = £1,776 - £1,590 = £186', energy.savingGbpPerYear === 186)
  check('saving basis is your_spend', energy.savingBasis === 'your_spend')
  check('sample-derived figures carry source sample', analysis.opportunities.every((o) => o.source === 'sample'))
  check('opportunity carries the detected supplier', energy.supplierName === 'British Gas')
  check('opportunity carries the price rise', energy.priceRise?.pct === 25.4)
  check('subscriptions are not switch opportunities', !analysis.opportunities.some((o) => o.category === 'subscription'))
  check('broadband saving computed', analysis.opportunities.find((o) => o.category === 'broadband')?.savingGbpPerYear === 60)
  check('mobile saving computed', analysis.opportunities.find((o) => o.category === 'mobile')?.savingGbpPerYear === 108)

  const dearer = computeOpportunity(bg, { energy: { ...SAMPLE_OFFER_BOOK.energy!, annualPriceGbp: 2500 } }, 'sample')
  check('offer dearer than current -> no saving', dearer.savingGbpPerYear === null && dearer.savingBasis === null)
  const none = computeOpportunity(bg, {}, 'sample')
  check('no offer -> no saving, no invented number', none.savingGbpPerYear === null && none.offer === null)
  const same = computeOpportunity(bg, { energy: { ...SAMPLE_OFFER_BOOK.energy!, providerName: 'British Gas' } }, 'sample')
  check('never offers the supplier the user is already with', same.offer === null && same.savingGbpPerYear === null)
  const typical = computeOpportunity(
    bg,
    { energy: { category: 'energy', providerName: 'Octopus Energy', url: null, verifiedSavingGbp: 220, sourceName: 'Research' } },
    'live'
  )
  check('typical saving used only when no annual price', typical.savingGbpPerYear === 220 && typical.savingBasis === 'typical' && typical.source === 'live')
  const noMoney = computeOpportunity(
    bg,
    { energy: { category: 'energy', providerName: 'Octopus Energy', url: null, sourceName: 'Research' } },
    'live'
  )
  check('offer with no price and no verified saving -> null', noMoney.savingGbpPerYear === null)

  // ── provider switch point / live stub ───────────────────────────────────────────────────────
  check('getBankProvider defaults to sample', getBankProvider().id === 'sample')
  let liveThrew = false
  try {
    await new LiveBankProvider().connect()
  } catch {
    liveThrew = true
  }
  check('live provider is a stub that makes no calls', liveThrew)

  // ── connection state: none | sample | live + snoozedUntil ───────────────────────────────────
  check('garbage state parses to none', parseBankState('x').status === 'none' && parseBankState({ status: 'wat' }).status === 'none')
  check('valid statuses survive', ['none', 'sample', 'live'].every((st) => parseBankState({ status: st }).status === st))
  check('bad snooze date is dropped', parseBankState({ status: 'none', snoozedUntil: 'nope' }).snoozedUntil === null)
  const t0 = new Date(Date.UTC(2026, 8, 30, 12))
  const snoozed = { status: 'none' as const, snoozedUntil: snoozeUntil(t0) }
  check('snooze is exactly 7 days', Date.parse(snoozed.snoozedUntil) - t0.getTime() === 7 * 86_400_000)
  check('card hidden while snoozed', !shouldShowBankConnectCard(snoozed, new Date(t0.getTime() + 6 * 86_400_000)))
  check('card returns after 7 days', shouldShowBankConnectCard(snoozed, new Date(t0.getTime() + 7 * 86_400_000 + 1)))
  check('snooze flag only true before expiry', isBankCardSnoozed(snoozed, t0) && !isBankCardSnoozed(snoozed, new Date(t0.getTime() + 8 * 86_400_000)))
  check('fresh user sees the Connect card', shouldShowBankConnectCard({ status: 'none', snoozedUntil: null }, t0))
  check('sample users never see the Connect card', !shouldShowBankConnectCard({ status: 'sample', snoozedUntil: null }, t0))
  check('live users never see the Connect card', !shouldShowBankConnectCard({ status: 'live', snoozedUntil: null }, t0))

  if (failures.length) {
    console.error('[bank] FAILED')
    for (const f of failures) console.error(`  • ${f}`)
    process.exit(1)
  }
  console.log(`[bank] OK — ${checks} checks passed`)
}

void main()
