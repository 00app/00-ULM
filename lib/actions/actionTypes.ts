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
 * How long "I've done this" should suppress an action for.
 *
 * Without this, completion has two equally bad failure modes: either everything hides forever,
 * so a habit like collecting surplus food vanishes the first time someone does it, or nothing
 * hides, so the wall keeps telling someone to apply for a Council Tax Reduction they were
 * awarded last month. The distinction is a property of the action, not of the user.
 *
 * ONCE    — a one-off application or purchase. Never resurfaces.
 * ANNUAL  — genuinely needs redoing each year. Several are annual by scheme design: WaterSure
 *           asks you to reconfirm eligibility yearly, NHS HC2 certificates expire, railcards
 *           run 12 months, and the Warm Home Discount runs in scheme years.
 * ONGOING — a habit. Doing it is the point, so it never suppresses.
 */
export type ActionRecurrence = 'ONCE' | 'ANNUAL' | 'ONGOING'

export const ANNUAL_SUPPRESSION_DAYS = 365

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
  /** Onboarding `household` values, e.g. ALONE — living arrangement, NOT a proxy for children. */
  household?: string[]
  /**
   * NONE | UNDER_5 | SCHOOL_AGE | BOTH.
   *
   * Child-linked entitlements were originally gated on household === FAMILY, which was wrong:
   * "family" describes who you live with, not whether children exist or how old they are. An
   * adult living with a parent answers FAMILY. Healthy Start needs an under-5 or a pregnancy;
   * free school meals needs a school-age child. Gating both on FAMILY asserted eligibility the
   * app had never actually asked about.
   */
  children?: string[]
  /** Onboarding `employmentStatus` values: STUDENT | EMPLOYED | BETWEEN_JOBS. */
  employment?: string[]
  /** Onboarding `age` values: JUNIOR | MID | RETIRED. Unlocks pension-age entitlements. */
  age?: string[]
  /** Onboarding `powerType` values. */
  heating?: string[]
  /** Onboarding `transport` values. */
  transport?: string[]
  /** Onboarding `washPreference` values. */
  wash?: string[]
  /** UK nations this scheme actually operates in. Devolved schemes differ. */
  countries?: Array<'ENGLAND' | 'WALES' | 'SCOTLAND' | 'NORTHERN_IRELAND'>
  /**
   * Loop-question answers, keyed by questionId → accepted answer values.
   *
   * Loop answers are simply more profile facts, so they gate exactly like onboarding answers
   * rather than living in a parallel system. That is what makes the loop *do* something: saying
   * "not yet" to a nudge widens your eligible pool, and the newly-eligible top action becomes the
   * next card you see. The card is therefore drawn from the vetted library with a real source and
   * URL, instead of being generated on the spot — which is how the old discovery cards ended up
   * generic.
   *
   * Values match LOOP_QUESTION_BANK option values exactly, e.g. { water_meter_save: ['NOT YET'] }.
   */
  loop?: Record<string, string[]>
}

export type ZoneAction = {
  id: string
  /** Imperative, one line, no locality interpolation — the ranker never fabricates local claims. */
  action: string
  /** Short supporting line. Where a figure appears it must be traceable to `source`. */
  detail: string
  verb: ActionVerb
  cost: ActionCost
  /** How long completing this hides it for. See ActionRecurrence. */
  recurrence: ActionRecurrence
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
  /**
   * RELEVANCE gates. An unknown profile value PASSES — "we don't know" shouldn't blank the wall
   * for someone who hasn't told us much. Use for things that make an action more apt, not for
   * things that decide whether someone qualifies.
   */
  gates?: ActionGates
  /**
   * ELIGIBILITY gates. An unknown profile value FAILS.
   *
   * The difference from `gates` is the whole difference between personalised and generic. Free
   * school meals was gated softly on having children, so anyone we hadn't asked still saw it —
   * the app confidently telling people to claim something it had no reason to think they
   * qualified for. If an action is only true for certain people, saying so requires knowing, and
   * not knowing has to mean not showing. Never guess an entitlement.
   */
  requires?: ActionGates
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

/** A completed action and when it was completed. */
export type ActionCompletion = {
  actionId: string
  /** ISO timestamp. */
  completedAt: string
}

/**
 * True when a completion should still be hiding this action at `now`.
 *
 * Unparseable or future dates are treated as "just completed" rather than ignored, so a bad
 * clock or a corrupt stored value can never resurrect a one-off claim someone already made.
 */
export function isSuppressedByCompletion(
  recurrence: ActionRecurrence,
  completedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!completedAt) return false
  if (recurrence === 'ONGOING') return false
  if (recurrence === 'ONCE') return true
  const then = Date.parse(completedAt)
  if (!Number.isFinite(then)) return true
  const days = (now.getTime() - then) / 86_400_000
  if (days < 0) return true
  return days < ANNUAL_SUPPRESSION_DAYS
}

/** Profile shape the ranker consumes. All optional — guests have none of it. */
export type ActionProfile = {
  tenure?: string | null
  financial?: string | null
  household?: string | null
  children?: string | null
  employment?: string | null
  age?: string | null
  /** questionId → answer value, from `journey_<id>_answers` in storage. */
  loopAnswers?: Record<string, string> | null
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
