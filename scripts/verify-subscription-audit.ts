/**
 * Ask-first subscriptions card: audit maths and truth rules.
 * Run: npx tsx scripts/verify-subscription-audit.ts
 */
import { buildSubscriptionAudit, resolveMonthlyPence } from '@/lib/cards/subscriptionAudit'
import { SUBSCRIPTION_SERVICES } from '@/lib/cards/subscriptionCatalog'

let passed = 0
const failures: string[] = []
function check(name: string, ok: boolean) {
  if (ok) passed++
  else failures.push(name)
}

// Catalogue truth: every priced plan has a source with a checked date; unpriced plans are null.
for (const s of SUBSCRIPTION_SERVICES) {
  const priced = s.plans.some((p) => p.monthlyPence != null)
  check(`${s.id}: priced plans carry a source`, !priced || Boolean(s.priceSource?.url && s.priceSource.checkedOn))
  for (const p of s.plans) check(`${s.id}/${p.id}: price is null or positive`, p.monthlyPence === null || p.monthlyPence > 0)
  check(`${s.id}: no dashes in source name`, !/[\u2013\u2014]/.test(s.priceSource?.name ?? ''))
}

// Unknown is unknown, never zero.
const unknown = buildSubscriptionAudit([{ serviceId: 'netflix', planId: 'premium', ownMonthlyPence: null, use: 'often' }])
check('unknown price counts as unknown', unknown.unknownCount === 1 && unknown.knownMonthlyPence === 0)
check('unknown price makes no saving', unknown.potentialYearlyPence === 0 && unknown.suggestions.length === 0)

// Own figure beats list price.
check('own figure wins', resolveMonthlyPence({ serviceId: 'spotify', planId: 'individual', ownMonthlyPence: 1100, use: null }).pence === 1100)
check('list price used when no own figure', resolveMonthlyPence({ serviceId: 'spotify', planId: 'individual', ownMonthlyPence: null, use: null }).from === 'list')

// Rarely used, priced: cancel saving is 12 months of its price.
const rarely = buildSubscriptionAudit([{ serviceId: 'disney', planId: 'premium', ownMonthlyPence: null, use: 'rarely' }])
const cancel = rarely.suggestions.find((s) => s.type === 'cancel_rarely')
check('rarely used suggests cancel', cancel?.type === 'cancel_rarely' && cancel.yearlyPence === 1599 * 12)
check('cancelled service is not also downgraded', !rarely.suggestions.some((s) => s.type === 'downgrade'))

// Sometimes used on a pricier plan: downgrade to the next plan down, sourced both sides.
const down = buildSubscriptionAudit([{ serviceId: 'disney', planId: 'premium', ownMonthlyPence: null, use: 'sometimes' }])
const dg = down.suggestions.find((s) => s.type === 'downgrade')
check('downgrade goes one step down', dg?.type === 'downgrade' && dg.toPlan === 'Standard' && dg.yearlyPence === (1599 - 1199) * 12)
check('often used is not nudged to downgrade', !buildSubscriptionAudit([{ serviceId: 'disney', planId: 'premium', ownMonthlyPence: null, use: 'often' }]).suggestions.length)
check('never downgrade to a student plan', !buildSubscriptionAudit([{ serviceId: 'spotify', planId: 'individual', ownMonthlyPence: null, use: 'sometimes' }]).suggestions.some((s) => s.type === 'downgrade'))

// Two music services: flagged, never auto-cancelled; saving only when both prices are known.
const music = buildSubscriptionAudit([
  { serviceId: 'spotify', planId: 'individual', ownMonthlyPence: null, use: 'often' },
  { serviceId: 'apple-music', planId: 'individual', ownMonthlyPence: null, use: 'often' },
])
const ov = music.suggestions.find((s) => s.type === 'overlap')
check('music overlap flagged', ov?.type === 'overlap' && ov.names.length === 2)
check('overlap saving withheld when a price is unknown', ov?.type === 'overlap' && ov.cheapestYearlyPence === null)
check('overlap not counted in potential total', music.potentialYearlyPence === 0)

// Totals add only known amounts.
const mixed = buildSubscriptionAudit([
  { serviceId: 'spotify', planId: 'duo', ownMonthlyPence: null, use: 'often' },
  { serviceId: 'gym', planId: 'membership', ownMonthlyPence: 2500, use: 'rarely', label: 'PureGym' },
  { serviceId: 'netflix', planId: 'standard', ownMonthlyPence: null, use: 'often' },
])
check('known total', mixed.knownMonthlyPence === 1799 + 2500)
check('unknown count', mixed.unknownCount === 1)
check('custom label used', mixed.lines.some((l) => l.name === 'PureGym'))
check('potential = rarely-used gym', mixed.potentialYearlyPence === 2500 * 12)

if (failures.length) {
  console.error(`[subscription-audit] FAIL: ${failures.length} failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`[subscription-audit] OK: ${passed} checks passed`)
