/**
 * Category spec types (PRD v4, Z6) — docs/INTELLIGENCE-LOGIC.md §3, made executable.
 *
 * The doc writes `when` and `compute` in words; here they are pure functions over the household
 * data service (Z3), so the same spec decides findings in the app, in tests and for Zai. Figures
 * only ever come from household facts or the action library, each with its source.
 */

import type { Household } from '@/lib/household/buildHousehold'
import type { FactSpec } from '@/lib/household/factRegistry'
import type { FactSource, HouseholdFact } from '@/lib/household/records'
import type { InsightCategory } from '@/lib/zone/insightCard'

export type MetricUnit = 'gbp' | 'gbp_month' | 'gbp_year' | 'kg_year' | 'kwh_year' | 'count' | 'date' | 'band' | 'percent' | 'text'

/** What a metric or rule sees: the household plus helpers that never invent a value. */
export type SpecContext = {
  h: Household
  now: Date
  fact: (key: string) => HouseholdFact | null
  /** String value upper-cased, or null. */
  str: (key: string) => string | null
  num: (key: string) => number | null
  bool: (key: string) => boolean | null
  /** ISO date value, or null. */
  date: (key: string) => string | null
  /** Days from today to a date fact (negative once passed), or null. */
  days: (key: string) => number | null
  list: (key: string) => Array<Record<string, unknown>> | null
  /** Library action ids this household is eligible for (existing ranker's hard filters). */
  eligible: ReadonlySet<string>
  month: number
}

export type MetricValue = {
  value: number | string
  /** Fact keys the value came from; the weakest one's source is shown under the metric. */
  from: string[]
  /** Overrides the facts' source, e.g. the action library for a count of grants. */
  source?: FactSource & { asOf: string }
}

export type MetricSpec = {
  key: string
  label: string
  unit: MetricUnit
  /** Fact keys the metric reads; the first missing one is the question that would fill it. */
  needs: string[]
  /** The doc's formula, in words. */
  computeNote: string
  compute: (ctx: SpecContext) => MetricValue | null
  /** For metrics fed by reference data (data/facts.json, NESO): the field that fills it. */
  referenceField?: string
}

export type OptionSpec = {
  key: string
  label: string
  /** A library action id; NEW ids not in the library yet are dropped from the card. */
  actionId?: string
  effortMinutes: number
  approvalTier: 0 | 1 | 2 | 3
  tradeOff: string
  prepares: 'link' | 'letter' | 'script' | 'reminder' | 'checklist' | 'none'
}

export type RuleSpec = {
  /** '<category>.<finding>' */
  id: string
  /** The doc's condition, in words. */
  whenNote: string
  when: (ctx: SpecContext) => boolean
  /** Plain English headline built from facts only; never a figure that is not a fact. */
  finding: (ctx: SpecContext) => string
  /** Fact keys shown in the Why panel. */
  drivers: string[]
  /** Library action ids (existing or NEW). */
  actions: string[]
  options: OptionSpec[]
  /** Fact key holding the date that makes this urgent. */
  deadlineFact?: string
  agent?: string
}

export type CategorySpec = {
  id: InsightCategory
  /** 'deep' categories were built first with full rules (Z6 order); 'basic' run on tier 1 data. */
  depth: 'deep' | 'basic'
  facts: FactSpec[]
  metrics: MetricSpec[]
  rules: RuleSpec[]
  soloExtras: string[]
  context: string[]
  /** Zone agents (lib/zoneAgents) a life event in this category switches on. */
  agents: string[]
}
