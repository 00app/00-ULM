/**
 * Crisis routes — a different mode of the app, not more cards.
 *
 * The rest of the library helps people who are squeezed: optimise the bills, claim what you're
 * owed, save a few hundred a year. This is for people who are drowning — no income, creditors
 * calling, the home at risk. Those need different things, and showing "save £70 a year" to
 * someone facing eviction reads as mockery no matter how it's worded.
 *
 * Three rules this file exists to enforce:
 *
 * 1. THE APP IS A SWITCHBOARD, NOT AN ADVISER. It never assesses eligibility here. Every route
 *    ends at a trained human. Getting someone to the right door quickly, with the right words
 *    ready, is the entire job — anything more is pretending to a competence we don't have and
 *    can't be accountable for.
 *
 * 2. POUNDS ARE THE WRONG UNIT. When the horizon is this week, "£/yr" is meaningless. `relief`
 *    says what the route DOES and how fast: "60 days — creditors must stop", "they must act",
 *    "today". That's the number that matters.
 *
 * 3. STALENESS IS A SAFETY ISSUE HERE, NOT A QUALITY ONE. A dead money tip is embarrassing; a
 *    dead helpline in front of someone at their limit is harmful. Every number below was
 *    verified against a live source on `verifiedOn`, only national numbers that don't move are
 *    used, and nothing local is hardcoded — councils change numbers constantly, so those route
 *    through the GOV.UK finder instead.
 */

/**
 * Fixed triage order. Deliberately NOT scored.
 *
 * The money wall ranks by value; crisis has a correct sequence regardless of value. Nobody
 * should be shown a tariff comparison above a homelessness duty because it scores higher. Lower
 * number surfaces first.
 */
export const CRISIS_ORDER = {
  /** Eat and stay safe this week. Nothing outranks this. */
  IMMEDIATE: 10,
  /** Stop the bleeding — legal protection from creditors while you get advice. */
  PROTECT: 20,
  /** Restore income. */
  INCOME: 30,
  /** Keep the roof. */
  HOUSING: 40,
  /** Someone to talk to. Last in order, not last in importance. */
  SUPPORT: 50,
} as const

export type CrisisNeed = 'DEBT' | 'INCOME' | 'HOUSING' | 'ANY'

export type CrisisRoute = {
  id: string
  /** Imperative and plain. No jargon, no scheme acronyms in the headline. */
  action: string
  /** One short line of what this actually is. */
  detail: string
  /**
   * What it does and how fast, in place of a £ figure. Shown where money normally sits.
   */
  relief: string
  /**
   * The words to say when they get through.
   *
   * The most valuable thing here, and the bit nobody else does. People rarely fail to get help
   * because they can't find a number — they fail because they get one fifteen-minute appointment
   * and don't know what to ask for. "Ask for Breathing Space" is worth more than the number on
   * its own.
   */
  askFor: string
  /** Freephone, national, stable. Omit rather than guess. */
  phone?: string
  /** Opening hours where the line isn't 24/7 — sending someone to a shut line at 11pm is cruel. */
  hours?: string
  url: string
  /** Which pressure this answers. ANY shows in every crisis mode. */
  need: CrisisNeed
  order: number
  /** Onboarding `age` values, where a route is age-specific. */
  age?: string[]
  source: string
  /** Tighter review cadence than the money library — see rule 3 above. */
  verifiedOn: string
}
