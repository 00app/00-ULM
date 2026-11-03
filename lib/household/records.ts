/**
 * Household data service — record types (PRD v4, Z3).
 *
 * Every fact the app knows about a household is one `HouseholdFact`: a value plus where it came
 * from, when, how sure we are and which tier of evidence it is. Cards, agents and Zai read these
 * instead of raw profile JSON, so a figure can never lose its source on the way to the screen.
 *
 * Mechanical truth: a fact we do not know is absent (lookups return `null`), never a 0 or an
 * empty string standing in for "unknown".
 *
 * Tiers and levels follow docs/INTELLIGENCE-LOGIC.md §2:
 *   tier 1 = public data (L0), tier 2 = the household told us (L1, L2, typed L3),
 *   tier 3 = bills or bank (L3, L4).
 */

import type { JourneyId } from '@/lib/journeys'

/** Journey categories plus Lifestyle, which becomes a JourneyId in Z5. */
export type HouseholdFactCategory = JourneyId | 'lifestyle'

export type Level = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'
export type Tier = 1 | 2 | 3
export type Confidence = 'high' | 'medium' | 'low'

/** Matches `household_facts.source_kind` in db/migrations/20261025_intelligence_layer.sql. */
export type SourceKind = 'public' | 'told_us' | 'bill' | 'bank' | 'derived' | 'sample'

export type FactSource = {
  kind: SourceKind
  /** Human name shown under a figure: "EPC register", "You told us", "Your bank (sample data)". */
  name: string
  url: string | null
}

export type FactValue = string | number | boolean | string[] | Record<string, unknown>[]

export type HouseholdFact<V extends FactValue = FactValue> = {
  /** `household_facts.field_key`, e.g. 'broadband_contract_end'. */
  key: string
  category: HouseholdFactCategory | 'profile'
  value: V
  unit: string | null
  source: FactSource
  /** ISO timestamp or date the value was true as of. Always set. */
  asOf: string
  confidence: Confidence
  /** Names the weakest part: "From what you told us at sign-up." */
  confidenceReason: string
  tier: Tier
  level: Level
}

/** The identity a household is read for. Guests have no accounts or bank data (signed-in only). */
export type HouseholdIdentity =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; guestSessionId: string }
  | { kind: 'synthetic'; syntheticId: string }

/**
 * A bill or contract as the service sees it. A loose superset of `HouseholdAccount` in
 * lib/household/data.ts so the v4 categories (streaming, membership, pet_insurance…) proposed in
 * the 20261025 migration flow through before that migration is applied.
 */
export type AccountInput = {
  id: string
  category: string
  provider_name: string | null
  monthly_amount_pence: number | null
  renewal_date: string | null
  contract_end_date: string | null
  source: 'manual' | 'bank'
  status: 'active' | 'ended'
  updated_at: string
  /** v4 column (migration not applied yet): visits a month for memberships. */
  uses_per_month?: number | null
  /** v4 column: whether an energy tariff is fixed. */
  is_fixed?: boolean | null
}

/** One stored `household_facts` row (when that table exists). */
export type StoredFactInput = {
  category: string
  field_key: string
  value: FactValue
  unit?: string | null
  source_kind: SourceKind
  source_name: string
  source_url: string | null
  as_of: string
  confidence: Confidence
  confidence_reason: string | null
  tier: Tier
}

export type Contract = {
  key: string
  category: HouseholdFactCategory
  accountCategory: string
  provider: string | null
  monthlyPricePence: number | null
  /** Not captured anywhere yet; stays null rather than guessed. */
  startDate: string | null
  endDate: string | null
  renewalDate: string | null
  source: FactSource
  asOf: string
  confidence: Confidence
  tier: Tier
}

export type Subscription = {
  key: string
  kind: 'streaming' | 'membership' | 'subscription' | 'pet_insurance' | 'other'
  name: string
  monthlyPricePence: number | null
  usesPerMonth: number | null
  source: FactSource
  asOf: string
  confidence: Confidence
  tier: Tier
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

export function isIsoDateLike(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && Number.isFinite(Date.parse(value))
}

export const TOLD_US_SOURCE: FactSource = { kind: 'told_us', name: 'You told us', url: null }

export function tierForSource(kind: SourceKind): Tier {
  if (kind === 'public' || kind === 'derived') return 1
  if (kind === 'bill' || kind === 'bank') return 3
  return 2
}
