/**
 * Crisis selection — fixed triage order, never scored.
 *
 * The money ranker sorts by value. This deliberately does not: in crisis there is a correct
 * sequence regardless of what anything is "worth". Eat this week, then stop creditors, then
 * restore income, then keep the roof. Someone must never be shown a tariff comparison above a
 * homelessness duty because it scored higher.
 */

import { CRISIS_ROUTES } from '@/lib/actions/crisisRoutes'
import { CRISIS_ORDER, type CrisisNeed, type CrisisRoute } from '@/lib/actions/crisisTypes'

/** See the filter in selectCrisisRoutes — stops the danger band swamping the essentials. */
const MAX_SAFETY_ROUTES = 3

/**
 * What the person said would help most.
 *
 * Deliberately a DESTINATION, not a status. Nobody has to tick a box saying they are in trouble;
 * they pick where they want to get to. Same move as "money's tight" instead of "broke" — it
 * reads as choosing rather than confessing, and people answer honestly far more often.
 */
export type HelpGoal = 'CUT_BILLS' | 'CLEAR_DEBT' | 'FIND_WORK' | 'KEEP_HOME'

/** CUT_BILLS is the ordinary path — everything else means someone needs the crisis routes first. */
export function isCrisisGoal(goal: string | null | undefined): boolean {
  const g = String(goal ?? '').trim().toUpperCase()
  return g === 'CLEAR_DEBT' || g === 'FIND_WORK' || g === 'KEEP_HOME'
}

function needForGoal(goal: string | null | undefined): CrisisNeed | null {
  switch (String(goal ?? '').trim().toUpperCase()) {
    case 'CLEAR_DEBT':
      return 'DEBT'
    case 'FIND_WORK':
      return 'INCOME'
    case 'KEEP_HOME':
      return 'HOUSING'
    default:
      return null
  }
}

export type CrisisSelectOptions = {
  /** Onboarding `age` — only gates genuinely age-specific routes, never restricts otherwise. */
  age?: string | null
  limit?: number
}

/**
 * Routes for someone in trouble, in triage order.
 *
 * Everything marked ANY always shows — food, emergency council help and someone to talk to are
 * relevant whatever brought them here. On top of that come the routes for their specific
 * pressure. The result is intentionally short: a wall of twenty options is its own kind of
 * unhelpful when someone is already overwhelmed.
 */
export function selectCrisisRoutes(
  goal: string | null | undefined,
  opts: CrisisSelectOptions = {}
): CrisisRoute[] {
  const need = needForGoal(goal)
  if (!need) return []
  const age = String(opts.age ?? '').trim().toUpperCase()

  const picked = CRISIS_ROUTES.filter((r) => {
    if (r.need !== 'ANY' && r.need !== need) return false
    // Age-specific routes only appear for that age; everything else is age-agnostic. An unknown
    // age never hides a general route.
    if (r.age && r.age.length > 0) {
      if (!age) return false
      return r.age.some((a) => a.toUpperCase() === age)
    }
    return true
  })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    // Cap the safety band before the overall limit.
    //
    // Danger routes sit above everything, so without their own ceiling a debt case surfaced six
    // of them and pushed Breathing Space and Samaritans off the end entirely — the band meant to
    // protect people was hiding the things most of them actually need. Three is enough to catch
    // the case; the rest stay reachable on the always-on help route.
    .filter((r, _i, all) => {
      if (r.order >= CRISIS_ORDER.IMMEDIATE) return true
      const safety = all.filter((x) => x.order < CRISIS_ORDER.IMMEDIATE)
      return safety.indexOf(r) < MAX_SAFETY_ROUTES
    })
    .slice(0, opts.limit ?? 10)

  // Someone to talk to must never be trimmed by a limit.
  //
  // The support route sits last in triage order, which meant a debt case with a full safety band
  // pushed Samaritans off the end. Being cut for space is an unacceptable reason to lose the one
  // route that matters if the rest of the wall is not enough.
  const support = CRISIS_ROUTES.filter((r) => r.order >= CRISIS_ORDER.SUPPORT)
  for (const r of support) {
    if (!picked.some((p) => p.id === r.id)) picked.push(r)
  }
  return picked
}

/**
 * Everything, for a permanent help route that needs no onboarding.
 *
 * Someone in trouble is not answering fourteen questions first, so the routes have to be
 * reachable without a profile at all.
 */
export function allCrisisRoutes(): CrisisRoute[] {
  return [...CRISIS_ROUTES].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
