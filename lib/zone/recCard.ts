/**
 * Zone recommendation card — one anatomy for every card on the Zone rails.
 *
 * Slots, in order: label · headline · whyYou · primaryCta · secondaryCta · badge.
 *
 * Mechanical truth lives HERE, not in the view:
 *  - A £ figure only survives if it carries a `savingSource`. No source → the figure is dropped
 *    and the headline falls back to the action wording. Nothing downstream can re-add it.
 *  - A card whose `whyYou` cannot be built from real or sample data is not a card: `resolveRecCard`
 *    returns null and the rails never see it.
 */

import type { JourneyId } from '@/lib/journeys'

export type RecCardSize = 'large' | 'small'

/** Where a £ figure came from. `sample` figures are always badged "Sample data". */
export type SavingSource = {
  kind: 'verified' | 'sample'
  /** Short human name shown/cited, e.g. "Ofgem" or "Octopus Energy". */
  name: string
  url?: string | null
  /** ISO date or display date of the source, when known. */
  date?: string | null
}

export type RecCardCtaKind =
  | 'open' // opens the card (Solo Focus)
  | 'connect_bank' // starts the bank connection
  | 'switch' // opens a partner switch link
  | 'confirm_switch' // user confirms they switched
  | 'done'

export type RecCardCta = {
  kind: RecCardCtaKind
  /** Verb-led label, e.g. "See how". */
  label: string
  /** External target for `switch`. */
  href?: string | null
}

/** What the card opens when tapped; the Zone page maps this to its existing open handlers. */
export type RecCardOpenRef =
  | { type: 'journey'; id: string }
  | { type: 'tip'; id: string }
  | { type: 'habit'; id: string }

export const SAMPLE_DATA_BADGE = 'Sample data' as const

export type RecCardModel = {
  id: string
  size: RecCardSize
  category: JourneyId
  /** Slot 1 — category label. */
  label: string
  /** Slot 2 — the headline as shown. */
  headline: string
  /** The action wording, always kept so the headline can fall back to it. */
  actionWording: string
  /** Verified £/yr saving, or null. Never set without `savingSource`. */
  savingGbpPerYear: number | null
  savingSource: SavingSource | null
  /** Slot 3 — one sentence tied to the user's data. */
  whyYou: string
  /** Slot 4. */
  primaryCta: RecCardCta
  /** Slot 5 — optional, low emphasis. */
  secondaryCta?: RecCardCta
  /** Slot 6 — optional. */
  badge?: typeof SAMPLE_DATA_BADGE
  /** True when the £ on this card can only be computed from the user's bank data. */
  dependsOnBank: boolean
  openRef: RecCardOpenRef
}

export type RecCardInput = {
  id: string
  size: RecCardSize
  category: JourneyId
  label: string
  /** Action wording, e.g. "reduce home energy costs". Required; it is the no-£ headline. */
  actionWording: string
  savingGbpPerYear?: number | null
  savingSource?: SavingSource | null
  whyYou: string | null | undefined
  primaryCta?: RecCardCta
  secondaryCta?: RecCardCta
  dependsOnBank?: boolean
  openRef: RecCardOpenRef
}

function sentenceCase(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`
}

export function formatSavingHeadline(gbp: number): string {
  const n = Math.round(gbp)
  return `Save £${n.toLocaleString('en-GB')} a year`
}

/**
 * Build a renderable card or return null.
 * Order of rules matters: the source rule runs before the headline is chosen.
 */
export function resolveRecCard(input: RecCardInput): RecCardModel | null {
  const whyYou = (input.whyYou ?? '').trim()
  if (!whyYou) return null

  const action = sentenceCase(input.actionWording)
  if (!action) return null

  const wantsFigure =
    typeof input.savingGbpPerYear === 'number' &&
    Number.isFinite(input.savingGbpPerYear) &&
    input.savingGbpPerYear > 0
  const source = input.savingSource && input.savingSource.name.trim() ? input.savingSource : null
  const keepFigure = wantsFigure && source != null
  const gbp = keepFigure ? Math.round(input.savingGbpPerYear as number) : null

  return {
    id: input.id,
    size: input.size,
    category: input.category,
    label: input.label,
    headline: gbp != null ? formatSavingHeadline(gbp) : action,
    actionWording: action,
    savingGbpPerYear: gbp,
    savingSource: gbp != null ? source : null,
    whyYou,
    primaryCta: input.primaryCta ?? { kind: 'open', label: 'See how' },
    secondaryCta: input.secondaryCta,
    badge: gbp != null && source?.kind === 'sample' ? SAMPLE_DATA_BADGE : undefined,
    dependsOnBank: Boolean(input.dependsOnBank),
    openRef: input.openRef,
  }
}

// ── whyYou ────────────────────────────────────────────────────────────────────────────────────

export type WhyYouFacts = {
  /** Place name if resolved, else the postcode outcode. */
  place?: string | null
  supplierName?: string | null
  homeType?: string | null
  powerType?: string | null
  tenure?: string | null
  transport?: string | null
  household?: string | null
  /** Real, observed monthly spend from bank data (Prompt 6). Pounds. */
  monthlyEnergySpendGbp?: number | null
  /** Supplier detected from bank data. */
  bankSupplierName?: string | null
}

const HOME_WORD: Record<string, string> = { FLAT: 'flat', HOUSE: 'house' }
const POWER_WORD: Record<string, string> = {
  GAS: 'gas',
  ELECTRIC: 'electricity',
  MIX: 'gas and electricity',
}
const TRANSPORT_WORD: Record<string, string> = {
  CAR: 'by car',
  PUBLIC: 'by public transport',
  BIKE: 'by bike',
  WALK: 'on foot',
  MIX: 'by a mix of ways',
}
const HOUSEHOLD_WORD: Record<string, string> = {
  ALONE: 'You live alone',
  COUPLE: 'You live with a partner',
  FAMILY: 'You live in a family home',
  SHARED: 'You share your home',
}

const ENERGY_JOURNEYS = new Set<JourneyId>(['home', 'utilities', 'solar', 'water'])
const TRAVEL_JOURNEYS = new Set<JourneyId>(['travel', 'holidays'])

/** One sentence from the user's real data, or null. Never filler. */
export function buildWhyYou(category: JourneyId, f: WhyYouFacts): string | null {
  if (ENERGY_JOURNEYS.has(category)) {
    if (f.bankSupplierName && f.monthlyEnergySpendGbp && f.monthlyEnergySpendGbp > 0) {
      return `You pay £${Math.round(f.monthlyEnergySpendGbp)}/mo to ${f.bankSupplierName}.`
    }
    if (f.supplierName) return `You're with ${f.supplierName}.`
    const home = f.homeType ? HOME_WORD[f.homeType.toUpperCase()] : undefined
    const power = f.powerType ? POWER_WORD[f.powerType.toUpperCase()] : undefined
    if (home && power) return `You heat a ${home} with ${power}.`
    if (home) return `You live in a ${home}.`
  }
  if (TRAVEL_JOURNEYS.has(category)) {
    const t = f.transport ? TRANSPORT_WORD[f.transport.toUpperCase()] : undefined
    if (t) return `You get around ${t}.`
  }
  const hh = f.household ? HOUSEHOLD_WORD[f.household.toUpperCase()] : undefined
  if (hh && !ENERGY_JOURNEYS.has(category) && !TRAVEL_JOURNEYS.has(category)) return `${hh}.`
  if (f.place && f.place.trim()) return `Based on where you live, ${f.place.trim()}.`
  return null
}

// ── ordering ──────────────────────────────────────────────────────────────────────────────────

/**
 * Sort by verified £/yr descending; cards with no verified £ come after all verified ones,
 * keeping their existing relative order (stable).
 */
export function sortRecCards<T extends Pick<RecCardModel, 'savingGbpPerYear'>>(cards: readonly T[]): T[] {
  const verified: { c: T; i: number }[] = []
  const rest: T[] = []
  cards.forEach((c, i) => {
    if (c.savingGbpPerYear != null && c.savingGbpPerYear > 0) verified.push({ c, i })
    else rest.push(c)
  })
  verified.sort((a, b) => (b.c.savingGbpPerYear as number) - (a.c.savingGbpPerYear as number) || a.i - b.i)
  return [...verified.map((v) => v.c), ...rest]
}
