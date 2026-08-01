/**
 * The tips row, drawn from the action library instead of the Rock habit catalog.
 *
 * What this replaces and why: the Rock catalog is 68 hand-written habits of which only 22 carry
 * any profile gating, rotated purely on day index and season. It knows nothing about tenure,
 * money or employment, so a renter who said money is tight could be shown "greywater plants,
 * SAVE £0" — ungated, unsourced, and worth nothing. Its own header describes the figures as
 * "indicative annual figures, rounded for UX", which is a different provenance standard from the
 * library's cited-and-dated values. Two standards on one screen is what made the wall read as
 * guesswork even where it wasn't.
 *
 * Tips keep a genuinely different job from the wall: they're the small, timely thing to do now.
 * So they're selected from the same gated pool but filtered by what's actionable at this hour,
 * and deliberately exclude anything already shown on the wall below.
 */

import type { ActionProfile, ZoneAction } from '@/lib/actions/actionTypes'
import { eligibleActions } from '@/lib/actions/selectActions'
import type { RockHabit } from '@/lib/rock/types'

export type TipTimeOfDay = 'morning' | 'afternoon' | 'evening'

/**
 * When an action is actually doable.
 *
 * This is the difference between a rotation that feels intelligent and one that feels random.
 * Anything requiring a phone call belongs in the afternoon, because council and supplier lines
 * are shut at 9pm — telling someone at bedtime to ring their water company is worse than showing
 * them nothing. Morning is what you do on the way out; evening is what you do while in the house.
 *
 * Derived from verb and bucket rather than tagged 63 times by hand, so new library entries get
 * sensible behaviour for free instead of silently defaulting into every slot.
 */
export function timeOfDayForAction(a: ZoneAction): TipTimeOfDay[] {
  // Applications and switches usually mean contacting an organisation during office hours.
  if (a.verb === 'CLAIM' || a.verb === 'SWITCH') return ['afternoon']
  if (a.bucket === 'travel') return ['morning']
  // Things you do standing in your own home.
  if (a.bucket === 'home' || a.bucket === 'utilities' || a.bucket === 'water') return ['evening']
  if (a.bucket === 'food') return ['morning', 'evening']
  return ['morning', 'afternoon', 'evening']
}

export type TipSelectOptions = {
  timeOfDay?: TipTimeOfDay
  /** Action ids already on the wall — a tip repeating a card below it is noise. */
  excludeIds?: Iterable<string>
  limit?: number
  month?: number
  now?: Date
}

/**
 * Tips for right now.
 *
 * Zero-value actions are excluded here specifically. On the wall a £0 card can still earn its
 * place on carbon or protection (the Priority Services Register saves nothing and matters a lot),
 * but in a three-slot "today's tips" strip "SAVE £0" reads as the app having nothing to say.
 */
export function selectTipActions(
  profile: ActionProfile,
  opts: TipSelectOptions = {}
): ZoneAction[] {
  const limit = opts.limit ?? 3
  const exclude = new Set(opts.excludeIds ?? [])
  const slot = opts.timeOfDay
  const pool = eligibleActions(profile, { month: opts.month, now: opts.now })

  const timely = pool.filter((a) => {
    if (exclude.has(a.id)) return false
    if (a.valueGbp <= 0) return false
    if (!slot) return true
    return timeOfDayForAction(a).includes(slot)
  })

  // One per category, so three tips never read as three versions of the same idea.
  const seenBuckets = new Set<string>()
  const picked: ZoneAction[] = []
  for (const a of timely) {
    if (picked.length >= limit) break
    if (seenBuckets.has(a.bucket)) continue
    seenBuckets.add(a.bucket)
    picked.push(a)
  }

  // Relax the one-per-category rule before ever returning a short strip.
  if (picked.length < limit) {
    for (const a of timely) {
      if (picked.length >= limit) break
      if (picked.some((p) => p.id === a.id)) continue
      picked.push(a)
    }
  }
  return picked
}

/**
 * Adapt a library action to the shape the existing tips strip renders.
 *
 * Deliberately an adapter rather than a rewrite of `RockSavingTips`: the row's look, its liked/
 * visited handling and its open behaviour are all fine — the problem was only ever where the
 * content came from. Keeping the render path untouched means this swap can't regress the UI.
 *
 * `slug` intentionally carries the action id so the existing `rock-<slug>` card id, the visited
 * store and the like handler keep working without a parallel identity scheme.
 */
export function actionToTipHabit(a: ZoneAction): RockHabit {
  return {
    slug: a.id,
    journey_key: a.bucket,
    title: a.action,
    insight: a.detail,
    money_gbp: a.valueGbp,
    carbon_kg: a.valueKg,
    provider_name: providerNameForUrl(a.url),
    learn_url: a.url,
    impact_tag: a.valueGbp > 0 && a.valueKg > 0 ? 'both' : a.valueGbp > 0 ? 'money' : 'carbon',
    time_of_day: timeOfDayForAction(a)[0],
  }
}

/** Publisher name from the destination host, so a tip can never credit a site it doesn't open. */
function providerNameForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return 'gov.uk'
  }
}

export function selectTipHabits(profile: ActionProfile, opts: TipSelectOptions = {}): RockHabit[] {
  return selectTipActions(profile, opts).map(actionToTipHabit)
}
