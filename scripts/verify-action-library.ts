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
import { buildGroovyGridItems } from '@/lib/zone/gridOrder'
import { applyArchitectEnrichment } from '@/lib/agents/contentArchitect'
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
  children: 'BOTH',
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
  children: 'NO',
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
  ownerPicks.some((a) => a.requires?.tenure?.includes('OWNER')),
  ownerPicks.map((a) => a.id).join(',')
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

// --- Child entitlements must never be asserted without knowing about children -------------
// household === FAMILY used to gate these, which was wrong: "family" describes who you live
// with, not whether children exist or their ages. An adult living with a parent answers FAMILY.
const CHILDLESS = { ...BROKE_RENTER, household: 'COUPLE', children: 'NO' }
const TODDLER = { ...BROKE_RENTER, children: 'UNDER_5' }
const SCHOOL = { ...BROKE_RENTER, children: 'SCHOOL_AGE' }

// The general principle, not just the child case: an eligibility claim must never be shown to
// someone we never asked. A soft gate would let it leak to everyone, which is exactly how a
// personalised wall degrades back into a generic one.
const UNKNOWN = { financial: 'TIGHT' } as ActionProfile
const requiresBackedIds = ZONE_ACTIONS.filter((a) => a.requires).map((a) => a.id)
assert(
  'eligibility-gated actions never show to an unasked profile',
  !eligibleActions(UNKNOWN, { month: 1 }).some((a) => requiresBackedIds.includes(a.id)),
  eligibleActions(UNKNOWN, { month: 1 })
    .filter((a) => requiresBackedIds.includes(a.id))
    .map((a) => a.id)
    .join(',')
)

const childActions = ['healthy-start-card', 'free-school-meals']
assert(
  'childless household sees no child entitlements',
  !eligibleActions(CHILDLESS, { month: 1 }).some((a) => childActions.includes(a.id)),
  eligibleActions(CHILDLESS, { month: 1 }).filter((a) => childActions.includes(a.id)).map((a) => a.id).join(',')
)

// Healthy Start needs an under-5; free school meals needs school age. Showing either to the
// wrong age band is a wasted slot and an obviously wrong recommendation.
const toddlerPicks = eligibleActions(TODDLER, { month: 1 })
assert('under-5 household sees Healthy Start', toddlerPicks.some((a) => a.id === 'healthy-start-card'))
assert(
  'under-5 household does NOT see free school meals',
  !toddlerPicks.some((a) => a.id === 'free-school-meals')
)

const schoolPicks = eligibleActions(SCHOOL, { month: 1 })
assert('school-age household sees free school meals', schoolPicks.some((a) => a.id === 'free-school-meals'))
assert(
  'school-age household does NOT see Healthy Start',
  !schoolPicks.some((a) => a.id === 'healthy-start-card')
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

// --- Grid rendering: the ranked wall must survive the bento grid intact -------------------
// Regression guard for a live bug: the grid keyed a Map on journey_key, which the old wall made
// unique by construction. A ranked wall can return several cards per category, so same-key cards
// collapsed to the last one and then rendered once per duplicate — the same MONEY tile printed a
// dozen times down the wall.
const gridCells = buildGroovyGridItems({
  viewModel: {
    hero: {} as never,
    journeys: actionsToJourneyCards(brokeRenterTwelve),
    tips: [],
    primaryMoneyJourneyKeys: [],
  },
  personaForJourney: () => 'default' as never,
})
const gridJourneyCells = gridCells.filter((c) => c.type === 'journey')
const renderedIds = gridJourneyCells.map((c) => (c as { item: { id: string } }).item.id)
assert(
  'grid renders no duplicate cards',
  new Set(renderedIds).size === renderedIds.length,
  renderedIds.join(',')
)
// And the ranker must not select more than the grid will actually show, or the wall silently
// renders fewer cards than were chosen (was 12 selected, 9 rendered).
assert(
  'every ranked card survives the grid',
  gridJourneyCells.length === brokeRenterTwelve.length,
  `selected ${brokeRenterTwelve.length}, rendered ${gridJourneyCells.length}`
)

// --- Loop answers unlock and retire actions ----------------------------------------------
// Loop answers are just more profile facts, so they gate identically to onboarding answers.
// That's what makes the loop DO something: answering widens the pool and the newly-eligible top
// action becomes the next card — drawn from the vetted library rather than generated on the fly,
// which is how the old discovery cards ended up generic.
const LOOPLESS: ActionProfile = { ...BROKE_RENTER }
const poolBefore = eligibleActions(LOOPLESS, { month: 1 })
const ANSWERED: ActionProfile = {
  ...BROKE_RENTER,
  loopAnswers: {
    water_meter_save: 'NOT YET',
    utilities_supplier_switch: 'NOT YET',
    shopping_repair_first: 'NOT YET',
  },
}
const poolAfter = eligibleActions(ANSWERED, { month: 1 })
assert(
  'answering loop questions unlocks new actions',
  poolAfter.length > poolBefore.length,
  `${poolBefore.length} -> ${poolAfter.length}`
)
// A loop unlock written as a soft gate unlocks nothing, because unanswered already passes — the
// action was in the pool all along. Caught exactly that way in testing.
const loopUnlocked = ZONE_ACTIONS.filter((a) => a.requires?.loop).map((a) => a.id)
assert(
  'loop-unlocked actions are hidden before the question is answered',
  !poolBefore.some((a) => loopUnlocked.includes(a.id)),
  poolBefore.filter((a) => loopUnlocked.includes(a.id)).map((a) => a.id).join(',')
)
assert(
  'loop-unlocked actions appear once answered',
  loopUnlocked.every((id) => poolAfter.some((a) => a.id === id)),
  loopUnlocked.filter((id) => !poolAfter.some((a) => a.id === id)).join(',')
)

// Saying you already do something must retire the nudge for it.
const COMPOSTS: ActionProfile = { ...BROKE_RENTER, loopAnswers: { waste_compost: 'YES' } }
assert(
  'a loop answer can retire an action',
  !eligibleActions(COMPOSTS, { month: 1 }).some((a) => a.id === 'freegle-local-reuse')
)
// But silence must never retire anything — an unanswered question is not a "no".
assert(
  'an unanswered loop question never excludes',
  eligibleActions(LOOPLESS, { month: 1 }).some((a) => a.id === 'freegle-local-reuse')
)

// --- Pool depth: ranking needs real choice ------------------------------------------------
// With 15 candidates for 12 slots the wall was 80% forced regardless of who you were, which is
// why distinct people were getting near-identical walls. Measured, not assumed.
for (const [label, prof] of [
  ['broke renter', BROKE_RENTER],
  ['comfortable owner', COMFORTABLE_OWNER],
] as Array<[string, ActionProfile]>) {
  const pool = eligibleActions(prof, { month: 1 }).length
  assert(`${label} has real choice (pool >= 20 for 12 slots)`, pool >= 20, `pool=${pool}`)
}

// --- Library cards survive the older enrichment pipeline ----------------------------------
// Second time a category-keyed rewrite has broken the ranked wall. applyArchitectEnrichment maps
// by journey_key, so with several cards in a category every one got the SAME payload stamped on
// it: identical titles on cards showing different £ values, old generated copy over verified
// library copy, and source_name overwritten independently of the URL it is supposed to describe.
const enriched = applyArchitectEnrichment(
  {
    hero: {} as never,
    journeys: actionsToJourneyCards(brokeRenterTwelve),
    tips: [],
    primaryMoneyJourneyKeys: [],
  },
  // A payload for every journey, i.e. the worst case.
  Object.fromEntries(
    brokeRenterTwelve.map((a) => [
      a.bucket,
      {
        headline: 'GENERATED HEADLINE THAT MUST NOT APPEAR',
        insight: 'generated',
        actionLine: 'generated',
        suppliedBy: 'WRONG.COM',
      },
    ])
  )
)
assert(
  'enrichment never overwrites library card titles',
  enriched.journeys.every((j) => !j.title.includes('MUST NOT APPEAR')),
  enriched.journeys.filter((j) => j.title.includes('MUST NOT APPEAR')).map((j) => j.id).join(',')
)
assert(
  'enrichment never overwrites the library source badge',
  enriched.journeys.every((j) => j.source_name !== 'WRONG.COM')
)
// The real user-visible symptom: same copy on cards with different values.
const enrichedTitles = enriched.journeys.map((j) => j.title)
assert(
  'no two library cards share a title',
  new Set(enrichedTitles).size === enrichedTitles.length,
  enrichedTitles.join(' | ')
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
