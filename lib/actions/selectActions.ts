/**
 * Selection and ranking — turns the tagged library into the twelve a specific person should see.
 *
 * Deliberately deterministic and free of any model call. The whole reason the wall read as
 * generic was that content was being generated to fill slots; the fix is to *select* from
 * material that is already known-good, so every card on screen can be traced to a library entry
 * with a source and a verification date. Same profile in, same twelve out, every time.
 *
 * Order of operations matters:
 *   1. Hard filters (exclusions, cost ceiling, gates, seasonal window) — remove, never penalise.
 *   2. Score what survives.
 *   3. Apply bucket diversity so one category cannot take every slot.
 */

import type { JourneyId } from '@/lib/journeys'
import {
  COST_CEILING,
  isSuppressedByCompletion,
  normalizeFinancialPressure,
  type ActionCompletion,
  type ActionGates,
  type ActionProfile,
  type ZoneAction,
} from '@/lib/actions/actionTypes'
import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { MAX_CARDS_PER_CATEGORY } from '@/lib/zone/perCategoryCardCap'

/**
 * No single category may occupy more than this many of the twelve slots.
 *
 * Deliberately the SAME constant the bento grid enforces. When these two disagreed the ranker
 * promised twelve cards, the grid silently dropped everything past its own per-category cap, and
 * the wall rendered nine — a mismatch invisible from either file alone. Importing it means the
 * ranker can never again select something the wall won't show.
 */
const MAX_PER_BUCKET = MAX_CARDS_PER_CATEGORY

function up(v: string | null | undefined): string {
  return String(v ?? '').trim().toUpperCase()
}

/**
 * Strict match — an absent profile value is NOT a match. Used for the scoring specificity bonus,
 * where rewarding an action for "matching" something we never learned would be fabricated
 * relevance.
 */
function matches(allowed: string[] | undefined, value: string | null | undefined): boolean {
  if (!allowed || allowed.length === 0) return true
  const v = up(value)
  if (!v) return false
  return allowed.some((a) => up(a) === v)
}

/**
 * Permissive match for gating — an absent profile value passes.
 *
 * A guest has told us nothing, so filtering them out of everything gated leaves a wall with
 * visible holes (verified: strict gating returned only 7 of 12). Absent means unknown, not
 * disqualified. Exclusions stay strict, so "unknown" can still never get someone shown
 * something actively wrong for them.
 */
function gateMatches(allowed: string[] | undefined, value: string | null | undefined): boolean {
  if (!allowed || allowed.length === 0) return true
  const v = up(value)
  if (!v) return true
  return allowed.some((a) => up(a) === v)
}

/**
 * Unknown profile values pass `gates` but never trigger `excludes`. A guest with no tenure
 * recorded should still see broadly-useful actions, but must never be *excluded* on the basis
 * of something we don't actually know about them.
 */
function gatesAllow(gates: ActionGates | undefined, p: ActionProfile): boolean {
  if (!gates) return true
  return (
    gateMatches(gates.tenure, p.tenure) &&
    gateMatches(gates.financial, p.financial) &&
    gateMatches(gates.household, p.household) &&
    gateMatches(gates.children, p.children) &&
    gateMatches(gates.employment, p.employment) &&
    gateMatches(gates.heating, p.heating) &&
    gateMatches(gates.transport, p.transport) &&
    gateMatches(gates.wash, p.wash) &&
    gateMatches(gates.countries, p.country)
  )
}

function excluded(ex: ActionGates | undefined, p: ActionProfile): boolean {
  if (!ex) return false
  const hit = (allowed: string[] | undefined, value: string | null | undefined) => {
    if (!allowed || allowed.length === 0) return false
    const v = up(value)
    if (!v) return false
    return allowed.some((a) => up(a) === v)
  }
  return (
    hit(ex.tenure, p.tenure) ||
    hit(ex.financial, p.financial) ||
    hit(ex.household, p.household) ||
    hit(ex.children, p.children) ||
    hit(ex.employment, p.employment) ||
    hit(ex.heating, p.heating) ||
    hit(ex.transport, p.transport) ||
    hit(ex.wash, p.wash) ||
    hit(ex.countries, p.country)
  )
}

function inWindow(a: ZoneAction, month: number): boolean {
  const months = a.window?.months
  if (!months || months.length === 0) return true
  return months.includes(month)
}

/**
 * Cost ceiling from the financial answer. Unknown financial state is treated as GETTING_BY —
 * the middle — so a guest is never shown a card that assumes they can spend freely.
 */
function costAllowed(a: ZoneAction, p: ActionProfile): boolean {
  const fin = normalizeFinancialPressure(p.financial) ?? 'GETTING_BY'
  return COST_CEILING[fin].includes(a.cost)
}

/**
 * Score. Money dominates because the app's promise is money, but free actions get a standing
 * bonus so that a £150 entitlement someone can actually claim today outranks a £250 saving that
 * requires £2,000 of capital first.
 */
export function scoreAction(a: ZoneAction, p: ActionProfile): number {
  let score = 0
  score += Math.min(a.valueGbp, 1500) / 10
  score += Math.min(a.valueKg, 1500) / 100
  if (a.cost === 'FREE') score += 25
  else if (a.cost === 'LOW') score += 8
  if (a.verb === 'CLAIM') score += 15
  score += a.priorityBoost ?? 0

  // Reward specificity: an action gated to this person's exact situation is more relevant than
  // one that applies to everybody, so tightly-targeted entries rise above the generic.
  const g = a.gates
  if (g) {
    if (g.tenure && matches(g.tenure, p.tenure)) score += 6
    if (g.household && matches(g.household, p.household)) score += 8
    if (g.children && matches(g.children, p.children)) score += 10
    if (g.heating && matches(g.heating, p.heating)) score += 6
    if (g.transport && matches(g.transport, p.transport)) score += 6
    if (g.wash && matches(g.wash, p.wash)) score += 4
  }
  return score
}

export type SelectOptions = {
  limit?: number
  /** 1-12. Injectable so tests aren't seasonal. */
  month?: number
  /** Library override, for tests. */
  library?: ZoneAction[]
  /** Things this person has already done. Suppression is recurrence-aware. */
  completions?: ActionCompletion[]
  /** Injectable clock so completion tests aren't time-dependent. */
  now?: Date
}

/** Everything that survives the hard filters, best first. No diversity cap applied. */
export function eligibleActions(p: ActionProfile, opts: SelectOptions = {}): ZoneAction[] {
  const month = opts.month ?? new Date().getMonth() + 1
  const library = opts.library ?? ZONE_ACTIONS
  const now = opts.now ?? new Date()
  const completedAt = new Map<string, string>()
  for (const c of opts.completions ?? []) {
    if (c?.actionId) completedAt.set(c.actionId, c.completedAt)
  }
  return library
    .filter((a) => !excluded(a.excludes, p))
    .filter((a) => gatesAllow(a.gates, p))
    .filter((a) => costAllowed(a, p))
    .filter((a) => inWindow(a, month))
    // Done means gone — for as long as that action's recurrence says it should be. A one-off
    // claim never returns; an annual one comes back after a year; a habit never hides.
    .filter((a) => !isSuppressedByCompletion(a.recurrence, completedAt.get(a.id), now))
    .sort((x, y) => scoreAction(y, p) - scoreAction(x, p) || x.id.localeCompare(y.id))
}

/**
 * The twelve. Diversity pass runs after scoring: walk the ranked list taking anything under the
 * per-bucket cap, then relax the cap to backfill if that left us short. Without the backfill a
 * thin library would return eight cards and leave visible holes in the grid.
 */
export function selectActionsForProfile(p: ActionProfile, opts: SelectOptions = {}): ZoneAction[] {
  const limit = opts.limit ?? 12
  const ranked = eligibleActions(p, opts)
  const perBucket = new Map<JourneyId, number>()
  const picked: ZoneAction[] = []

  for (const a of ranked) {
    if (picked.length >= limit) break
    const used = perBucket.get(a.bucket) ?? 0
    if (used >= MAX_PER_BUCKET) continue
    perBucket.set(a.bucket, used + 1)
    picked.push(a)
  }

  if (picked.length < limit) {
    const already = new Set(picked.map((a) => a.id))
    for (const a of ranked) {
      if (picked.length >= limit) break
      if (already.has(a.id)) continue
      picked.push(a)
    }
  }

  return picked
}
