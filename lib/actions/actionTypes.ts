/**
 * Tagged action library — the replacement for "fill 12 category slots regardless of relevance".
 *
 * The old model gave every user one card per category, so a non-driver got a TRAVEL card and a
 * renter got a SOLAR card. When a slot *must* be filled, the only copy that always fits is copy
 * vague enough to fit anyone — which is exactly why the wall read as generic. Here, actions are
 * tagged with who they apply to and then ranked, so a slot is earned rather than padded.
 *
 * Two fields carry most of the weight:
 *
 * - `excludes` — more important than `appliesTo`. Showing a renter "insulate your loft" is the
 *   single fastest way to look stupid, and no amount of good copy recovers from it. Exclusions
 *   are hard filters, never soft score penalties.
 * - `cost` — the axis the app was missing entirely. Almost every existing tip assumed capital
 *   (solar, heat pump, new appliance). For someone who answered TIGHT that is not merely
 *   unhelpful, it's insulting. Financial pressure sets a hard ceiling on this.
 */

import type { JourneyId } from '@/lib/journeys'

/**
 * What the user actually does. Doubles as an honesty check on the link: a CLAIM action must
 * deep-link to a form or eligibility checker, never to an explainer article. If the destination
 * is something to read rather than something to do, it isn't an action.
 */
export type ActionVerb = 'CLAIM' | 'SWITCH' | 'DO' | 'BUY'

/**
 * Capital required to act. `FREE` means genuinely £0 up front — claiming an entitlement,
 * switching a tariff, changing a habit. `LOW` is roughly under £30. `HIGH` is anything
 * needing real money (insulation, appliances, generation).
 */
export type ActionCost = 'FREE' | 'LOW' | 'HIGH'

export type FinancialPressure = 'TIGHT' | 'GETTING_BY' | 'DOING_OK'
export type Tenure = 'OWNER' | 'RENTER'

/**
 * Hard ceiling on `cost` per financial answer. TIGHT sees only free actions — not as a
 * judgement about what they can afford, but because a paid recommendation burns one of twelve
 * slots that a claimable entitlement could have used. GETTING_BY allows small spends. DOING_OK
 * is uncapped but still ranks free money first, because unclaimed entitlements don't stop being
 * worth claiming just because someone isn't stressed.
 */
export const COST_CEILING: Record<FinancialPressure, ActionCost[]> = {
  TIGHT: ['FREE'],
  GETTING_BY: ['FREE', 'LOW'],
  DOING_OK: ['FREE', 'LOW', 'HIGH'],
}

/**
 * Availability window for time-boxed schemes. Several real UK entitlements are seasonal or have
 * closed/reopening dates — Warm Home Discount was closed at the time of writing and reopens in
 * October 2026, and the Household Support Fund ended 31 March 2026 and was replaced by the
 * Crisis and Resilience Fund. Without this field the library silently rots into confidently
 * telling people to claim things that no longer exist, which is worse than showing nothing.
 */
export type ActionWindow = {
  /** Inclusive month numbers (1-12) when this is worth surfacing. Omit for always-on. */
  months?: number[]
  /** ISO date after which this action must not be shown without re-verification. */
  reviewBy?: string
}

export type ActionGates = {
  /** Omit to mean "any tenure". */
  tenure?: Tenure[]
  /** Omit to mean "any financial state" (still subject to COST_CEILING). */
  financial?: FinancialPressure[]
  /** Onboarding `household` values, e.g. FAMILY — used for child-linked entitlements. */
  household?: string[]
  /** Onboarding `employmentStatus` values. */
  employment?: string[]
  /** Onboarding `powerType` values. */
  heating?: string[]
  /** Onboarding `transport` values. */
  transport?: string[]
  /** Onboarding `washPreference` values. */
  wash?: string[]
  /** UK nations this scheme actually operates in. Devolved schemes differ. */
  countries?: Array<'ENGLAND' | 'WALES' | 'SCOTLAND' | 'NORTHERN_IRELAND'>
}

export type ZoneAction = {
  id: string
  /** Imperative, one line, no locality interpolation — the ranker never fabricates local claims. */
  action: string
  /** Short supporting line. Where a figure appears it must be traceable to `source`. */
  detail: string
  verb: ActionVerb
  cost: ActionCost
  /** Category bucket — used only for diversity control, never shown as the primary structure. */
  bucket: JourneyId
  /** Annual £ this can realistically return. 0 where the value is real but not monetary. */
  valueGbp: number
  /** Annual kg CO2e. 0 where the action is purely financial. */
  valueKg: number
  /** Must be a form, checker, calculator or comparison — never an explainer. */
  url: string
  /** Where the £ figure and eligibility came from. */
  source: string
  /** ISO date the source was last checked. Stale dates are a maintenance signal, not decoration. */
  verifiedOn: string
  gates?: ActionGates
  /**
   * Hard filters. Anything matching is removed outright before scoring — never softened into a
   * ranking penalty, because "unlikely to show" still eventually shows.
   */
  excludes?: ActionGates
  window?: ActionWindow
  /**
   * Manual nudge for things whose value isn't captured by £ alone — e.g. an umbrella benefits
   * check is worth surfacing high because it unlocks everything else. Keep sparing.
   */
  priorityBoost?: number
}

/** Profile shape the ranker consumes. All optional — guests have none of it. */
export type ActionProfile = {
  tenure?: string | null
  financial?: string | null
  household?: string | null
  employment?: string | null
  heating?: string | null
  transport?: string | null
  wash?: string | null
  country?: string | null
}

export function normalizeFinancialPressure(v: string | null | undefined): FinancialPressure | null {
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'TIGHT' || s === 'GETTING_BY' || s === 'DOING_OK' ? s : null
}

export function normalizeTenure(v: string | null | undefined): Tenure | null {
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'OWNER' || s === 'RENTER' ? s : null
}

/**
 * Financial pressure → cost ceiling, but only ever DOWNWARD from what the user said.
 *
 * Kept here rather than in the ranker so the onboarding answer has exactly one interpretation
 * across the codebase. See the matching asymmetry note in app/api/user/route.ts: TIGHT is
 * allowed to restrict, but "doing OK" is never allowed to be read as "can afford anything",
 * because it reports absence of stress, not disposable income.
 */
export function affordableCosts(v: string | null | undefined): ActionCost[] {
  const fin = normalizeFinancialPressure(v)
  return fin ? COST_CEILING[fin] : COST_CEILING.GETTING_BY
}
