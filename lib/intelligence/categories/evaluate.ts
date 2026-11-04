/**
 * Category spec evaluator (PRD v4, Z6): household (Z3) + category spec → InsightCards (Z4).
 *
 * Rules decide, code computes, nothing is generated: the headline is the rule's finding built
 * from facts, metrics come from the spec, drivers and confidence from the facts the rule read,
 * options and figures from the action library with its citation. Every card goes through
 * `resolveInsightCard`, so anything that cannot meet the contract becomes Coming soon.
 *
 * Library actions keep their own hard filters: a rule whose library actions are all filtered out
 * for this household (an owner-only grant for a renter, a HIGH-cost action for TIGHT) does not
 * show. The one exception is a loop-question unlock (`requires.loop`): a rule that fired on the
 * household's facts already establishes the relevance that loop answer stands for, so a fix ending
 * in 20 days still shows "compare tariffs" without first answering the supplier-switch nudge.
 * A rule whose actions are all still NEW (not in the library yet) shows as information, with no
 * action link and no figure.
 */

import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { eligibleActions } from '@/lib/actions/selectActions'
import type { Household } from '@/lib/household/buildHousehold'
import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { getGaps, knowledgeOf, toActionProfile } from '@/lib/household/queries'
import type { Confidence, HouseholdFact } from '@/lib/household/records'
import { isIsoDateLike } from '@/lib/household/records'
import { JOURNEY_LABELS, JOURNEYS } from '@/lib/journeys'
import { CATEGORY_SPEC_ORDER, CATEGORY_SPECS } from '@/lib/intelligence/categories/registry'
import { inHeatingSeason, longDate, pounds } from '@/lib/intelligence/categories/shared'
import type { CategorySpec, MetricSpec, OptionSpec, RuleSpec, SpecContext } from '@/lib/intelligence/categories/types'
import { CARD_QUESTION_IDS, getCardQuestion } from '@/lib/zone/cardQuestions'
import { LOOP_QUESTION_BANK } from '@/lib/zone/loopQuestions'
import { typicalSavingForLibraryCard } from '@/lib/zone/recCardFromZone'
import {
  comingSoonCard,
  resolveInsightCard,
  type InsightCard,
  type InsightCategory,
} from '@/lib/zone/insightCard'

const LIBRARY_IDS = new Set(ZONE_ACTIONS.map((a) => a.id))

/** The library with loop-question unlocks lifted; every other hard filter stays. */
const LIBRARY_FOR_RULES = ZONE_ACTIONS.map((a) => {
  if (!a.requires?.loop) return a
  const { loop: _loop, ...rest } = a.requires
  void _loop
  return { ...a, requires: Object.keys(rest).length > 0 ? rest : undefined }
})

/** Action ids the specs name that are not in the library yet (docs/INTELLIGENCE-LOGIC.md §10). */
export const NEW_ACTION_IDS: readonly string[] = [
  ...new Set(
    CATEGORY_SPEC_ORDER.flatMap((c) => CATEGORY_SPECS[c].rules.flatMap((r) => [...r.actions, ...r.options.map((o) => o.actionId ?? '')]))
      .filter((id) => id && !LIBRARY_IDS.has(id))
  ),
].sort()

// Card questions (lib/zone/cardQuestions.ts) are asked on Solo Focus the same way loop beats are.
const LOOP_IDS = new Set([...LOOP_QUESTION_BANK.map((b) => b.questionId), ...CARD_QUESTION_IDS])
const ONBOARDING_IDS = new Set(Object.values(JOURNEYS).flatMap((j) => j.questions.map((q) => q.id)))
const FACT_LABELS = new Map(Object.values(CATEGORY_FACTS).flat().map((f) => [f.key, f.label]))

const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dateOnly = (iso: string) => iso.slice(0, 10)

// ── context ───────────────────────────────────────────────────────────────────────────────────

const ruleEligibility = new WeakMap<SpecContext, Set<string>>()

/** Actions a fired rule may offer: eligible once its loop unlock is taken as met. */
function ruleEligible(ctx: SpecContext): Set<string> {
  let set = ruleEligibility.get(ctx)
  if (!set) {
    set = new Set(eligibleActions(toActionProfile(ctx.h), { now: ctx.now, month: ctx.month, library: LIBRARY_FOR_RULES }).map((a) => a.id))
    ruleEligibility.set(ctx, set)
  }
  return set
}

export function specContext(h: Household, now: Date = new Date()): SpecContext {
  const month = now.getUTCMonth() + 1
  const fact = (key: string): HouseholdFact | null => h.facts[key] ?? null
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const date = (key: string) => {
    const v = fact(key)?.value
    return isIsoDateLike(v) ? dateOnly(v) : null
  }
  return {
    h,
    now,
    month,
    fact,
    str: (key) => {
      const v = fact(key)?.value
      return typeof v === 'string' ? v.trim().toUpperCase() : null
    },
    num: (key) => {
      const v = fact(key)?.value
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    },
    bool: (key) => {
      const v = fact(key)?.value
      return typeof v === 'boolean' ? v : null
    },
    date,
    days: (key) => {
      const d = date(key)
      return d ? Math.round((Date.parse(`${d}T00:00:00Z`) - today) / 86_400_000) : null
    },
    list: (key) => {
      const v = fact(key)?.value
      return Array.isArray(v) && v.every((x) => x && typeof x === 'object') ? (v as Array<Record<string, unknown>>) : null
    },
    eligible: new Set(eligibleActions(toActionProfile(h), { now, month }).map((a) => a.id)),
  }
}

// ── pieces of a card ─────────────────────────────────────────────────────────────────────────

function figureSourceFor(facts: HouseholdFact[]) {
  const weakest = [...facts].sort((a, b) => CONF_RANK[a.confidence] - CONF_RANK[b.confidence])[0]
  if (!weakest) return null
  return { name: weakest.source.name, url: weakest.source.url?.startsWith('https://') ? weakest.source.url : null, asOf: dateOnly(weakest.asOf) }
}

function evaluateMetric(m: MetricSpec, ctx: SpecContext): InsightCard['metrics'][number] {
  const out = m.compute(ctx)
  const gapField = m.needs.find((k) => !ctx.fact(k)) ?? m.referenceField ?? m.needs[0] ?? `metric:${m.key}`
  if (!out) return { key: m.key, label: m.label, value: null, unit: m.unit, source: null, gapField }
  const source = out.source
    ? { name: out.source.name, url: out.source.url?.startsWith('https://') ? out.source.url : null, asOf: dateOnly(out.source.asOf) }
    : figureSourceFor(out.from.map((k) => ctx.fact(k)).filter((f): f is HouseholdFact => f !== null))
  if (!source) return { key: m.key, label: m.label, value: null, unit: m.unit, source: null, gapField }
  return { key: m.key, label: m.label, value: out.value, unit: m.unit, source, gapField: null }
}

function displayValue(f: HouseholdFact): string {
  const v = f.value
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (f.unit === 'pence_month') return `£${pounds(v).toFixed(2)} a month`
    if (f.unit === 'pence_year') return `£${pounds(v).toFixed(2)} a year`
    return String(v)
  }
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x && 'name' in x ? String((x as { name: unknown }).name) : String(x))).join(', ')
  if (isIsoDateLike(v)) return longDate(v)
  return String(v)
}

function driversFor(rule: RuleSpec, ctx: SpecContext): InsightCard['why'] {
  return rule.drivers.flatMap((key) => {
    const f = ctx.fact(key)
    if (!f) return []
    return [
      {
        factKey: key,
        label: FACT_LABELS.get(key) ?? key,
        value: displayValue(f),
        source: { name: f.source.name, url: f.source.url?.startsWith('https://') ? f.source.url : null, asOf: dateOnly(f.asOf) },
      },
    ]
  })
}

/** §4.3: the weakest driver sets the level, and the reason names it. */
function confidenceFor(rule: RuleSpec, ctx: SpecContext): InsightCard['confidence'] {
  const facts = rule.drivers.map((k) => ctx.fact(k)).filter((f): f is HouseholdFact => f !== null)
  if (facts.length === 0) return { level: 'low', reason: 'Low: this applies to most homes; we have none of your details for it yet.' }
  const weakest = [...facts].sort((a, b) => CONF_RANK[a.confidence] - CONF_RANK[b.confidence])[0]
  const label = (FACT_LABELS.get(weakest.key) ?? weakest.key).toLowerCase()
  return { level: weakest.confidence, reason: `${capital(weakest.confidence)}: ${label}. ${weakest.confidenceReason}` }
}

function optionFor(o: OptionSpec, ctx: SpecContext): InsightCard['options'][number] {
  const actionId = o.actionId && LIBRARY_IDS.has(o.actionId) && ruleEligible(ctx).has(o.actionId) ? o.actionId : null
  const typical = actionId ? typicalSavingForLibraryCard(`journey-${actionId}`) : null
  const source = typical?.source?.date
    ? { name: typical.source.name, url: typical.source.url?.startsWith('https://') ? typical.source.url : null, asOf: typical.source.date }
    : null
  return {
    key: o.key,
    label: o.label,
    actionId,
    impact:
      typical && source
        ? { kind: 'typical', gbpRange: { low: typical.gbp, high: typical.gbp }, kgRange: null, source }
        : { kind: null, gbpRange: null, kgRange: null, source: null },
    effortMinutes: o.effortMinutes,
    approvalTier: o.approvalTier,
    tradeOff: o.tradeOff,
    // The library links are public bodies and charities; nothing here pays us. Partner links (Z10)
    // must set this when they arrive.
    commission: { paid: false, note: null },
  }
}

function gapsFor(spec: CategorySpec, h: Household): InsightCard['gaps'] {
  return getGaps(h, spec.id)
    .map((g) => {
      const questionId = g.questionId && LOOP_IDS.has(g.questionId) ? g.questionId : g.onboardingKey && ONBOARDING_IDS.has(g.onboardingKey) ? g.onboardingKey : null
      if (!questionId) return null
      const whyWeAsk = getCardQuestion(questionId)?.whyWeAsk ?? `Your ${g.label.toLowerCase()} changes what we suggest here.`
      return { questionId, field: g.key, whyWeAsk }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .slice(0, 3)
}

function contextFor(spec: CategorySpec, rule: RuleSpec, ctx: SpecContext): InsightCard['context'] {
  const chips: InsightCard['context'] = []
  if (rule.deadlineFact) {
    const d = ctx.date(rule.deadlineFact)
    const days = ctx.days(rule.deadlineFact)
    if (d && days !== null && days >= 0 && days <= 60) {
      chips.push({ key: 'contract_deadline', label: `${FACT_LABELS.get(rule.deadlineFact) ?? 'Deadline'}: ${longDate(d)}`, asOf: d })
    }
  }
  if (spec.context.includes('heating_season') && inHeatingSeason(ctx.month)) {
    chips.push({ key: 'heating_season', label: 'Heating season', asOf: null })
  }
  return chips
}

// ── evaluation ───────────────────────────────────────────────────────────────────────────────

export type Finding = {
  rule: RuleSpec
  headline: string
  /** Library actions this household is eligible for. */
  actions: string[]
  /** Spec actions not in the library yet. */
  newActions: string[]
}

export type CategoryEvaluation = {
  category: InsightCategory
  metrics: InsightCard['metrics']
  knowledge: ReturnType<typeof knowledgeOf>
  /** The questions that would fill this category's most valuable missing facts (up to 3). */
  gaps: InsightCard['gaps']
  findings: Finding[]
  /** Rules that matched on facts but whose library actions this household cannot take. */
  suppressed: string[]
  cards: InsightCard[]
  issues: string[]
}

export function evaluateCategory(spec: CategorySpec, ctx: SpecContext): CategoryEvaluation {
  const metrics = spec.metrics.map((m) => evaluateMetric(m, ctx))
  const findings: Finding[] = []
  const suppressed: string[] = []
  for (const rule of spec.rules) {
    if (!rule.when(ctx)) continue
    const existing = rule.actions.filter((id) => LIBRARY_IDS.has(id))
    const actions = existing.filter((id) => ruleEligible(ctx).has(id))
    if (existing.length > 0 && actions.length === 0) {
      suppressed.push(rule.id)
      continue
    }
    findings.push({ rule, headline: rule.finding(ctx), actions, newActions: rule.actions.filter((id) => !LIBRARY_IDS.has(id)) })
  }

  const label = JOURNEY_LABELS[spec.id].toUpperCase()
  const known = metrics.find((m) => m.value !== null && m.source !== null)
  const gaps = gapsFor(spec, ctx.h)
  const cards: InsightCard[] = []
  const issues: string[] = []

  for (const f of findings) {
    const options = f.rule.options.map((o) => optionFor(o, ctx))
    const why = driversFor(f.rule, ctx)
    const driverFacts = f.rule.drivers.map((k) => ctx.fact(k)).filter((x): x is HouseholdFact => x !== null)
    const recommended = options.find((o) => o.impact.gbpRange && o.impact.source) ?? null
    const live = driverFacts.some((x) => x.tier === 3 && (x.source.kind === 'bank' || x.source.kind === 'bill'))
    const first = options[0]
    const candidate: InsightCard = {
      id: f.rule.id.replace('.', ':'),
      category: spec.id,
      statusTag: live && known ? 'live_data' : 'ready',
      label,
      headline: f.headline,
      keyMetric: known ? { label: known.label, value: known.value as number | string, unit: known.unit, source: known.source! } : null,
      metrics,
      why,
      confidence: confidenceFor(f.rule, ctx),
      saving: recommended
        ? { kind: 'typical', gbpRange: recommended.impact.gbpRange, kgRange: null, source: recommended.impact.source, method: null, evidence: null }
        : null,
      effort: { minutes: first?.effortMinutes ?? null, approvalTier: first?.approvalTier ?? 0 },
      options,
      gaps,
      context: contextFor(spec, f.rule, ctx),
      nextStep: first ? { label: first.label, optionKey: first.key, approvalTier: first.approvalTier } : null,
      related: [],
      tier: (Math.max(1, ...driverFacts.map((x) => x.tier)) as 1 | 2 | 3),
    }
    const r = resolveInsightCard(candidate)
    if (!r.ok) issues.push(`${candidate.id}: ${r.issues.join('; ')}`)
    cards.push(r.card)
  }

  // Nothing to say yet → one Coming soon card, so the category is visibly waiting, not missing.
  if (cards.length === 0) cards.push(comingSoonCard({ id: `${spec.id}:coming_soon`, category: spec.id, label }))

  return { category: spec.id, metrics, knowledge: knowledgeOf(ctx.h, spec.id), gaps, findings, suppressed, cards, issues }
}

/** Every category's cards for one household, deep categories first, rule order within each. */
export function buildCategoryInsights(
  h: Household,
  opts: { now?: Date; categories?: InsightCategory[] } = {}
): { cards: InsightCard[]; byCategory: CategoryEvaluation[] } {
  const ctx = specContext(h, opts.now)
  const byCategory = (opts.categories ?? CATEGORY_SPEC_ORDER).map((c) => evaluateCategory(CATEGORY_SPECS[c], ctx))
  return { cards: byCategory.flatMap((e) => e.cards), byCategory }
}
