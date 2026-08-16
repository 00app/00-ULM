/**
 * Crisis routes are the one place in this app where being wrong hurts someone.
 *
 * A stale money tip is embarrassing. A dead helpline, a shut line at 11pm, or a promise about
 * eligibility we can't keep, in front of someone at their limit, is harm. So these assertions are
 * about safety rather than quality, and they are deliberately strict.
 */

import { CRISIS_ROUTES } from '@/lib/actions/crisisRoutes'
import { selectCrisisRoutes, isCrisisGoal, allCrisisRoutes } from '@/lib/actions/selectCrisisRoutes'
import { CRISIS_ORDER } from '@/lib/actions/crisisTypes'
import { crisisRoutesToCards } from '@/lib/actions/crisisCards'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
const assert = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail })

// --- Every route must be safe to put in front of someone in trouble ---------------------
for (const r of CRISIS_ROUTES) {
  assert(`${r.id}: https url`, r.url.startsWith('https://'), r.url)
  assert(`${r.id}: has a source`, r.source.trim().length > 10)
  assert(`${r.id}: dated`, /^\d{4}-\d{2}-\d{2}$/.test(r.verifiedOn), r.verifiedOn)

  // The whole point of the feature — the words to say when someone picks up.
  assert(`${r.id}: says what to ask for`, r.askFor.trim().length > 15, r.askFor)

  // `relief` replaces £/yr. A pound sign in the wrong place reintroduces exactly the unit that
  // reads as mockery when someone is facing eviction.
  assert(`${r.id}: relief is not a yearly saving`, !/\/yr|per year|a year$/i.test(r.relief), r.relief)

  // Freephone, so someone with 20p of credit can still ring. One documented exception: Stop Loan
  // Sharks is 0300 (national rate, usually inside inclusive minutes) and is the only route there
  // is for illegal lending — so it is allowed, but its card has to say it is not free.
  if (r.phone) {
    const digits = r.phone.replace(/\s/g, '')
    const freephone = /^(0800|0808|116)/.test(digits)
    assert(
      `${r.id}: freephone (or flagged as not)`,
      freephone || (digits.startsWith('0300') && /not free|national rate/i.test(r.hours ?? '')),
      r.phone
    )
    // Sending someone to a shut line at 11pm is its own small cruelty.
    assert(`${r.id}: states opening hours`, Boolean(r.hours), 'no hours given')
  }

  // The app is a switchboard, not an adviser. It must never assert what someone will get.
  assert(
    `${r.id}: promises no entitlement`,
    !/you will get|you are entitled|guaranteed|you qualify/i.test(`${r.detail} ${r.askFor}`),
    r.detail
  )
}

assert('no duplicate ids', new Set(CRISIS_ROUTES.map((r) => r.id)).size === CRISIS_ROUTES.length)

// --- Triage order, not ranking -----------------------------------------------------------
const debt = selectCrisisRoutes('CLEAR_DEBT')
const housing = selectCrisisRoutes('KEEP_HOME')
const income = selectCrisisRoutes('FIND_WORK')

assert('CUT_BILLS is not a crisis', selectCrisisRoutes('CUT_BILLS').length === 0)
assert('unanswered is not a crisis', selectCrisisRoutes(undefined).length === 0)
assert('isCrisisGoal excludes CUT_BILLS', !isCrisisGoal('CUT_BILLS') && isCrisisGoal('KEEP_HOME'))

for (const [label, list] of [['debt', debt], ['housing', housing], ['income', income]] as const) {
  assert(`${label}: returns routes`, list.length >= 4, `got ${list.length}`)
  // Danger outranks everything, then food. If someone is unsafe, every other route on the wall
  // is the wrong advice for them.
  assert(
    `${label}: danger leads`,
    list[0]?.id === 'domestic-abuse-helpline',
    list[0]?.id
  )
  const firstNonSafety = list.find((r) => r.order >= CRISIS_ORDER.IMMEDIATE)
  assert(`${label}: food leads once past danger`, firstNonSafety?.id === 'food-bank-referral', firstNonSafety?.id)
  // The danger band must never swamp the essentials.
  assert(
    `${label}: safety band capped`,
    list.filter((r) => r.order < CRISIS_ORDER.IMMEDIATE).length <= 3
  )
  assert(
    `${label}: sorted by triage order`,
    list.every((r, i) => i === 0 || list[i - 1].order <= r.order)
  )
  // Someone to talk to is always reachable.
  assert(`${label}: includes support`, list.some((r) => r.order === CRISIS_ORDER.SUPPORT))
  // Short by design — twenty options is its own kind of unhelpful when overwhelmed.
  assert(`${label}: stays short`, list.length <= 11, `got ${list.length}`)
}

assert('debt route includes Breathing Space', debt.some((r) => r.id === 'breathing-space'))
assert('housing route includes the 56-day duty', housing.some((r) => r.id === 'council-homeless-duty'))
assert('income route includes Help to Claim', income.some((r) => r.id === 'help-to-claim'))

// --- Age-specific routes ------------------------------------------------------------------
assert(
  'under-25 housing gets Centrepoint',
  selectCrisisRoutes('KEEP_HOME', { age: 'JUNIOR' }).some((r) => r.id === 'centrepoint-under-25')
)
assert(
  'unknown age never hides general routes',
  selectCrisisRoutes('KEEP_HOME', {}).some((r) => r.id === 'shelter-helpline')
)
assert(
  'age-specific route stays out for other ages',
  !selectCrisisRoutes('KEEP_HOME', { age: 'RETIRED' }).some((r) => r.id === 'centrepoint-under-25')
)

// --- Reachable with no profile at all -----------------------------------------------------
// Someone in trouble is not answering fourteen questions first.
assert('all routes reachable without onboarding', allCrisisRoutes().length === CRISIS_ROUTES.length)

// --- Cards ---------------------------------------------------------------------------------
const cards = crisisRoutesToCards(debt)
assert('cards carry the ask-for line', cards.every((c) => (c.explanation?.[1] ?? '').startsWith('What to say:')))
assert('cards show relief, never £0', cards.every((c) => c.data.money !== '£0' && c.data.money.length > 2))
assert('card ids unique', new Set(cards.map((c) => c.id)).size === cards.length)
assert('cards deep-link to the route', cards.every((c) => c.actions?.learnUrl?.startsWith('https://')))

const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error('[crisis-routes] FAILED')
  for (const f of failed) console.error(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
console.log(`[crisis-routes] OK — ${checks.length} checks passed`)
console.log(`  ${CRISIS_ROUTES.length} routes, all freephone/national, verified 2026-07-31`)
