/**
 * Read-side queries over a built `Household`. Pure functions: pass the household (and `now`
 * where dates matter) so cards, agents, Zai and tests all get the same answer.
 */

import { eligibleActions, type SelectOptions } from '@/lib/actions/selectActions'
import type { ActionProfile, ZoneAction } from '@/lib/actions/actionTypes'
import type { Household } from '@/lib/household/buildHousehold'
import { CATEGORY_FACTS, type FactSpec } from '@/lib/household/factRegistry'
import {
  isIsoDateLike,
  type Contract,
  type HouseholdFact,
  type HouseholdFactCategory,
  type Subscription,
} from '@/lib/household/records'

/** Peer figures are never shown for groups smaller than this (PRD v4, Z12 privacy floor). */
export const MIN_PEER_GROUP = 5

export type KnowledgeState = 'unknown' | 'partial' | 'known'

export type CategoryFacts = {
  category: HouseholdFactCategory
  facts: Array<{ spec: FactSpec; fact: HouseholdFact | null }>
  knowledge: { known: number; total: number; score: number; state: KnowledgeState }
}

/** One fact by key, or null. Never a default. */
export function getFact(h: Household, key: string): HouseholdFact | null {
  return h.facts[key] ?? null
}

/** docs/INTELLIGENCE-LOGIC.md §2: weight of known facts ÷ weight of all facts in the category. */
export function knowledgeOf(h: Household, category: HouseholdFactCategory): CategoryFacts['knowledge'] {
  const specs = CATEGORY_FACTS[category]
  const total = specs.reduce((s, f) => s + f.weight, 0)
  const knownSpecs = specs.filter((f) => h.facts[f.key])
  const score = total === 0 ? 0 : knownSpecs.reduce((s, f) => s + f.weight, 0) / total
  const state: KnowledgeState = score < 0.2 ? 'unknown' : score > 0.7 ? 'known' : 'partial'
  return { known: knownSpecs.length, total: specs.length, score, state }
}

export function getCategoryFacts(h: Household, category: HouseholdFactCategory): CategoryFacts {
  return {
    category,
    facts: CATEGORY_FACTS[category].map((spec) => ({ spec, fact: h.facts[spec.key] ?? null })),
    knowledge: knowledgeOf(h, category),
  }
}

export type Gap = FactSpec & { category: HouseholdFactCategory; askable: boolean }

/**
 * Facts this category is missing, most valuable first. Public (L0) facts are never returned:
 * we look those up, we do not ask (§4.2). `askable` is false until a question exists for it.
 * Value-ranking against £ at stake is Z7; this orders by fact weight only.
 */
export function getGaps(h: Household, category: HouseholdFactCategory): Gap[] {
  return CATEGORY_FACTS[category]
    .filter((spec) => spec.level !== 'L0' && !h.facts[spec.key])
    .filter((spec) => !(spec.from.length === 1 && spec.from[0] === 'derived'))
    .map((spec) => ({ ...spec, category, askable: Boolean(spec.questionId || spec.onboardingKey) }))
    .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key))
}

const CONTRACT_KEYS: Array<{
  key: string
  category: HouseholdFactCategory
  accountCategory: string
  end?: string
  renewal?: string
  price?: string
  provider?: string
}> = [
  { key: 'broadband', category: 'tech', accountCategory: 'broadband', end: 'broadband_contract_end', price: 'broadband_monthly_price', provider: 'broadband_provider' },
  { key: 'mobile', category: 'tech', accountCategory: 'mobile', end: 'mobile_contract_end', price: 'mobile_monthly_price' },
  { key: 'energy', category: 'utilities', accountCategory: 'electricity', end: 'fix_end_date', price: 'energy_direct_debit', provider: 'supplier' },
  { key: 'home_insurance', category: 'home', accountCategory: 'home_insurance', renewal: 'home_insurance_renewal' },
  { key: 'car_insurance', category: 'travel', accountCategory: 'car_insurance', renewal: 'car_insurance_renewal' },
  { key: 'vehicle_tax', category: 'travel', accountCategory: 'vehicle_tax', renewal: 'vehicle_tax_due' },
  { key: 'pet_insurance', category: 'lifestyle', accountCategory: 'pet_insurance', renewal: 'pet_insurance_renewal' },
]

/**
 * Contracts with an end or renewal date we know. One per kind; the date fact decides source,
 * as-of and confidence, because the date is what makes a contract actionable.
 */
export function getContracts(h: Household): Contract[] {
  const out: Contract[] = []
  for (const c of CONTRACT_KEYS) {
    const end = c.end ? h.facts[c.end] : undefined
    const renewal = c.renewal ? h.facts[c.renewal] : undefined
    const dated = end ?? renewal
    if (!dated || !isIsoDateLike(dated.value)) continue
    const price = c.price ? h.facts[c.price] : undefined
    const provider = c.provider ? h.facts[c.provider] : undefined
    const account = h.accounts.find((a) => a.category === c.accountCategory)
    out.push({
      key: c.key,
      category: c.category,
      accountCategory: c.accountCategory,
      provider: typeof provider?.value === 'string' ? provider.value : account?.provider_name ?? null,
      monthlyPricePence: typeof price?.value === 'number' ? price.value : null,
      startDate: null,
      endDate: end && isIsoDateLike(end.value) ? end.value : null,
      renewalDate: renewal && isIsoDateLike(renewal.value) ? renewal.value : null,
      source: dated.source,
      asOf: dated.asOf,
      confidence: dated.confidence,
      tier: dated.tier,
    })
  }
  return out.sort((a, b) => (a.endDate ?? a.renewalDate ?? '').localeCompare(b.endDate ?? b.renewalDate ?? ''))
}

/** Days from `now` to an ISO date (negative when it has passed), or null. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!isIsoDateLike(date)) return null
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((day(new Date(date)) - day(now)) / 86_400_000)
}

export function getSubscriptions(h: Household): Subscription[] {
  const kinds: Array<[string, Subscription['kind']]> = [
    ['streaming_services', 'streaming'],
    ['memberships', 'membership'],
    ['subscriptions', 'subscription'],
  ]
  const out: Subscription[] = []
  for (const [key, kind] of kinds) {
    const fact = h.facts[key]
    if (!fact || !Array.isArray(fact.value)) continue
    for (const item of fact.value as Array<Record<string, unknown>>) {
      const name = typeof item.name === 'string' ? item.name : null
      if (!name) continue
      out.push({
        key: `${kind}:${name.toLowerCase()}`,
        kind,
        name,
        monthlyPricePence: typeof item.monthlyPence === 'number' ? item.monthlyPence : null,
        usesPerMonth: typeof item.usesPerMonth === 'number' ? item.usesPerMonth : null,
        source: fact.source,
        asOf: fact.asOf,
        confidence: fact.confidence,
        tier: fact.tier,
      })
    }
  }
  return out
}

const str = (h: Household, key: string): string | null => {
  const v = h.facts[key]?.value
  return typeof v === 'string' ? v : null
}

/** The household as the action ranker's profile, so eligibility has one interpretation. */
export function toActionProfile(h: Household): ActionProfile {
  return {
    tenure: str(h, 'tenure'),
    financial: str(h, 'financial_pressure'),
    household: str(h, 'household'),
    children: str(h, 'children'),
    employment: str(h, 'employment_status'),
    age: str(h, 'age_group'),
    loopAnswers: Object.keys(h.answers).length > 0 ? h.answers : null,
    heating: str(h, 'power_type'),
    supplier: str(h, 'supplier'),
    transport: str(h, 'transport'),
    wash: str(h, 'wash_preference'),
    country: h.country,
  }
}

export type Eligibility = {
  action: ZoneAction
  /** True when the action has `requires` gates and the household meets them (not just "unknown passes"). */
  confirmed: boolean
}

/** Library actions this household can see, best first, via the existing ranker's hard filters. */
export function getEligibility(h: Household, opts: SelectOptions = {}): Eligibility[] {
  return eligibleActions(toActionProfile(h), opts).map((action) => ({
    action,
    confirmed: Boolean(action.requires && Object.keys(action.requires).length > 0),
  }))
}

export type PeerComparison = {
  factKey: string
  peers: number
  median: number
  p25: number
  p75: number
  yours: number | null
}

/**
 * How a numeric fact compares with similar households. Returns null when fewer than
 * MIN_PEER_GROUP peers have the fact: no figure is better than one that could identify someone.
 * `peers` is the comparison pool (synthetic in dev; aggregated real data arrives with Z12).
 */
export function getPeerComparison(
  h: Household,
  factKey: string,
  peers: readonly Household[],
  opts: { sameAs?: string[] } = {}
): PeerComparison | null {
  const match = (p: Household) =>
    p !== h &&
    (opts.sameAs ?? []).every((k) => {
      const mine = h.facts[k]?.value
      return mine !== undefined && p.facts[k]?.value === mine
    })
  const values = peers
    .filter(match)
    .map((p) => p.facts[factKey]?.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b)
  if (values.length < MIN_PEER_GROUP) return null
  const q = (p: number) => {
    const i = (values.length - 1) * p
    const lo = Math.floor(i)
    return values[lo] + (values[Math.ceil(i)] - values[lo]) * (i - lo)
  }
  const yours = h.facts[factKey]?.value
  return {
    factKey,
    peers: values.length,
    median: q(0.5),
    p25: q(0.25),
    p75: q(0.75),
    yours: typeof yours === 'number' ? yours : null,
  }
}
