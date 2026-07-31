/**
 * Proves the action library's safety guarantees rather than trusting them.
 *
 * The failures this is designed to catch are the ones that quietly make the app look stupid:
 * a renter told to insulate a loft, someone who said money is tight shown a £2,000 purchase, or
 * a £ figure with no traceable source. These are exactly the kind of thing that survives code
 * review and only shows up in front of a real user, so they get asserted here instead.
 */

import { ZONE_ACTIONS, isValidZoneCardSlug } from '@/lib/actions/actionLibrary'
import { selectActionsForProfile, eligibleActions } from '@/lib/actions/selectActions'
import { actionsToJourneyCards } from '@/lib/actions/actionCards'
import type { ActionProfile } from '@/lib/actions/actionTypes'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
function assert(name: string, pass: boolean, detail?: string): void {
  checks.push({ name, pass, detail })
}

const BROKE_RENTER: ActionProfile = {
  tenure: 'RENTER',
  financial: 'TIGHT',
  household: 'FAMILY',
  employment: 'BETWEEN_JOBS',
  heating: 'GAS',
  transport: 'PUBLIC',
  wash: 'SHOWER',
  country: 'ENGLAND',
}

const COMFORTABLE_OWNER: ActionProfile = {
  tenure: 'OWNER',
  financial: 'DOING_OK',
  household: 'COUPLE',
  employment: 'EMPLOYED',
  heating: 'GAS',
  transport: 'CAR',
  wash: 'BOTH',
  country: 'ENGLAND',
}

const GUEST: ActionProfile = {}

// --- Library integrity ------------------------------------------------------------------
for (const a of ZONE_ACTIONS) {
  assert(`${a.id}: https url`, a.url.startsWith('https://'), a.url)
  assert(`${a.id}: has source`, a.source.trim().length > 8)
  assert(`${a.id}: has verifiedOn date`, /^\d{4}-\d{2}-\d{2}$/.test(a.verifiedOn), a.verifiedOn)
  assert(`${a.id}: action text is short`, a.action.split(/\s+/).length <= 7, a.action)
}

const ids = ZONE_ACTIONS.map((a) => a.id)
assert('no duplicate action ids', new Set(ids).size === ids.length)

// --- The guarantee that matters most ----------------------------------------------------
// A renter must never be shown something they are structurally unable to act on.
const renterPicks = eligibleActions(BROKE_RENTER, { month: 1 })
const ownerOnly = ZONE_ACTIONS.filter((a) => a.excludes?.tenure?.includes('RENTER')).map((a) => a.id)
assert(
  'renter never sees owner-only actions',
  renterPicks.every((a) => !ownerOnly.includes(a.id)),
  `owner-only=${ownerOnly.join(',')}`
)

// Someone who said money is tight must never be shown something that costs money.
assert(
  'TIGHT never sees paid actions',
  renterPicks.every((a) => a.cost === 'FREE'),
  renterPicks.filter((a) => a.cost !== 'FREE').map((a) => a.id).join(',')
)

// Suggesting where to invest savings to someone with none.
assert(
  'TIGHT never sees the savings-investment action',
  !renterPicks.some((a) => a.id === 'ethical-isa')
)

// --- Coverage: the hardest column must actually fill ------------------------------------
// Run in January so seasonal entries are live; a thin library shows up here as a short wall.
const brokeRenterTwelve = selectActionsForProfile(BROKE_RENTER, { month: 1 })
assert(
  'broke renter fills 12 slots',
  brokeRenterTwelve.length === 12,
  `got ${brokeRenterTwelve.length}`
)
assert(
  'broke renter wall is all free',
  brokeRenterTwelve.every((a) => a.cost === 'FREE')
)
assert(
  'broke renter leads with a CLAIM action',
  brokeRenterTwelve[0]?.verb === 'CLAIM',
  brokeRenterTwelve[0]?.id
)
assert(
  'entitlement check ranks in the top three',
  brokeRenterTwelve.slice(0, 3).some((a) => a.id === 'benefits-entitlement-check'),
  brokeRenterTwelve.slice(0, 3).map((a) => a.id).join(',')
)

// --- Diversity --------------------------------------------------------------------------
const bucketCounts = new Map<string, number>()
for (const a of brokeRenterTwelve) bucketCounts.set(a.bucket, (bucketCounts.get(a.bucket) ?? 0) + 1)
assert(
  'no bucket dominates the wall',
  Array.from(bucketCounts.values()).every((n) => n <= 4),
  Array.from(bucketCounts.entries()).map(([k, v]) => `${k}:${v}`).join(' ')
)

// --- Other columns still work -----------------------------------------------------------
const ownerPicks = selectActionsForProfile(COMFORTABLE_OWNER, { month: 1 })
assert('comfortable owner fills 12 slots', ownerPicks.length === 12, `got ${ownerPicks.length}`)
assert(
  'owner can see owner-only actions',
  ownerPicks.some((a) => a.gates?.tenure?.includes('OWNER')),
)

// A guest has told us nothing, so must never be excluded on unknown grounds, and must never be
// assumed able to spend.
const guestPicks = selectActionsForProfile(GUEST, { month: 1 })
assert('guest still gets a full wall', guestPicks.length === 12, `got ${guestPicks.length}`)
assert(
  'guest is never assumed able to spend big',
  guestPicks.every((a) => a.cost !== 'HIGH'),
  guestPicks.filter((a) => a.cost === 'HIGH').map((a) => a.id).join(',')
)

// --- Seasonal correctness ---------------------------------------------------------------
// Warm Home Discount is closed over the summer; surfacing it in July tells people to claim
// something they currently cannot.
const july = eligibleActions(BROKE_RENTER, { month: 7 })
assert(
  'closed seasonal scheme is hidden out of window',
  !july.some((a) => a.id === 'warm-home-discount')
)
const january = eligibleActions(BROKE_RENTER, { month: 1 })
assert(
  'seasonal scheme returns in window',
  january.some((a) => a.id === 'warm-home-discount')
)

// --- Card mapping -----------------------------------------------------------------------
const cards = actionsToJourneyCards(brokeRenterTwelve)
assert('every action maps to a card', cards.length === brokeRenterTwelve.length)

const cardIds = cards.map((c) => c.id)
assert('card ids are unique', new Set(cardIds).size === cardIds.length, cardIds.join(','))

// A ranked wall can hold several cards from one bucket, so every card must be addressable by
// the /zone/card/[journeyKey] route or deep links and the back button silently 404.
assert(
  'every card id resolves as a route slug',
  brokeRenterTwelve.every((a) => isValidZoneCardSlug(a.id)),
  brokeRenterTwelve.filter((a) => !isValidZoneCardSlug(a.id)).map((a) => a.id).join(',')
)

// The exact bug found on the live wall: a card badged "DEFRA AVIATION FACTORS" whose button
// opened eurostar.com. Deriving the badge from the destination host makes it unrepresentable.
assert(
  'source badge always matches the destination host',
  cards.every((c) => {
    const host = new URL(c.actions!.learnUrl).hostname.replace(/^www\./i, '').toUpperCase()
    return c.source_name === host
  }),
  cards.map((c) => `${c.source_name}->${c.actions!.learnUrl}`).slice(0, 3).join(' ')
)

assert(
  'every card links to its action url',
  cards.every((c) => c.actions?.learnUrl && c.actions.learnUrl.startsWith('https://'))
)
assert(
  'claim cards carry a claim url',
  cards.filter((c) => c.isPriorityAlert).every((c) => Boolean(c.claimOfferUrl))
)
assert(
  'every card carries explanation text',
  cards.every((c) => (c.explanation?.[0]?.length ?? 0) > 20)
)

// --- Completion suppression -------------------------------------------------------------
const NOW = new Date('2026-07-31T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

// A one-off claim must never come back. Being told to apply for a Council Tax Reduction you were
// awarded last month is the clearest possible sign the app isn't listening.
const afterCouncilTax = eligibleActions(BROKE_RENTER, {
  month: 1,
  now: NOW,
  completions: [{ actionId: 'council-tax-reduction', completedAt: daysAgo(30) }],
})
assert(
  'completed ONCE action does not return',
  !afterCouncilTax.some((a) => a.id === 'council-tax-reduction')
)

// An annual one should come back — but only after a year.
const annualRecent = eligibleActions(BROKE_RENTER, {
  month: 1,
  now: NOW,
  completions: [{ actionId: 'benefits-entitlement-check', completedAt: daysAgo(200) }],
})
assert(
  'ANNUAL action stays hidden inside a year',
  !annualRecent.some((a) => a.id === 'benefits-entitlement-check')
)
const annualStale = eligibleActions(BROKE_RENTER, {
  month: 1,
  now: NOW,
  completions: [{ actionId: 'benefits-entitlement-check', completedAt: daysAgo(400) }],
})
assert(
  'ANNUAL action returns after a year',
  annualStale.some((a) => a.id === 'benefits-entitlement-check')
)

// Habits are the point — doing them must not delete them.
const afterHabit = eligibleActions(BROKE_RENTER, {
  month: 1,
  now: NOW,
  completions: [{ actionId: 'surplus-food-app', completedAt: daysAgo(1) }],
})
assert(
  'ONGOING action is never suppressed',
  afterHabit.some((a) => a.id === 'surplus-food-app')
)

// The wall must not develop holes as someone works through it.
const afterThree = selectActionsForProfile(BROKE_RENTER, {
  month: 1,
  now: NOW,
  completions: [
    { actionId: 'council-tax-reduction', completedAt: daysAgo(10) },
    { actionId: 'free-school-meals', completedAt: daysAgo(10) },
    { actionId: 'healthy-start-card', completedAt: daysAgo(10) },
  ],
})
assert(
  'wall refills after completions',
  afterThree.length === 12,
  `got ${afterThree.length}`
)
assert(
  'completed actions are gone from the refilled wall',
  !afterThree.some((a) =>
    ['council-tax-reduction', 'free-school-meals', 'healthy-start-card'].includes(a.id)
  )
)

// Corrupt or future timestamps must fail safe (stay hidden), never resurrect a done claim.
assert(
  'unparseable completion date fails safe',
  !eligibleActions(BROKE_RENTER, {
    month: 1,
    now: NOW,
    completions: [{ actionId: 'nhs-low-income-scheme', completedAt: 'not-a-date' }],
  }).some((a) => a.id === 'nhs-low-income-scheme')
)

// Every action must declare recurrence, or completion silently does nothing for it.
assert(
  'every action declares recurrence',
  ZONE_ACTIONS.every((a) => ['ONCE', 'ANNUAL', 'ONGOING'].includes(a.recurrence)),
  ZONE_ACTIONS.filter((a) => !a.recurrence).map((a) => a.id).join(',')
)

// --- Determinism ------------------------------------------------------------------------
const runA = selectActionsForProfile(BROKE_RENTER, { month: 1 }).map((a) => a.id).join(',')
const runB = selectActionsForProfile(BROKE_RENTER, { month: 1 }).map((a) => a.id).join(',')
assert('selection is deterministic', runA === runB)

// --- Report -----------------------------------------------------------------------------
const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error('[action-library] FAILED')
  for (const f of failed) console.error(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
console.log(`[action-library] OK — ${checks.length} checks passed`)
console.log(`  library size: ${ZONE_ACTIONS.length} actions`)
console.log(`  broke renter wall: ${brokeRenterTwelve.map((a) => a.id).join(', ')}`)
