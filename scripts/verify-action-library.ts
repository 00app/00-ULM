/**
 * Proves the action library's safety guarantees rather than trusting them.
 *
 * The failures this is designed to catch are the ones that quietly make the app look stupid:
 * a renter told to insulate a loft, someone who said money is tight shown a £2,000 purchase, or
 * a £ figure with no traceable source. These are exactly the kind of thing that survives code
 * review and only shows up in front of a real user, so they get asserted here instead.
 */

import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { selectActionsForProfile, eligibleActions } from '@/lib/actions/selectActions'
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
