/**
 * InsightCard — one contract for Zone cards and Solo Focus (PRD v4, Z4).
 *
 * Extends the rec card (lib/zone/recCard.ts) rather than replacing it: `resolveRecCard` still
 * decides whether a card exists at all, and `insightFromRecCard` lifts any rec card into this
 * contract. The contract adds what v4 needs on top: status, confidence, metrics, why drivers,
 * options, gaps, context and a typed saving.
 *
 * Mechanical truth is enforced by the schema, not by the view:
 *  - Every figure (key metric, metric value, saving range, option impact) carries a source with a
 *    name and an as-of date. A £ without a source does not parse.
 *  - `realised` savings need evidence (a task_evidence row, Z11). `estimated` needs a method.
 *    `sample` is always demo and always low confidence.
 *  - A card that cannot meet the contract is not shown half-built: `resolveInsightCard` returns a
 *    Coming soon card for it instead, and reports why.
 */

import { z } from 'zod'
import { JOURNEY_IDS } from '@/lib/journeys'
import type { RecCardModel, SavingSource } from '@/lib/zone/recCard'

// ── building blocks ──────────────────────────────────────────────────────────────────────────

export const INSIGHT_CATEGORIES = [...JOURNEY_IDS, 'lifestyle'] as const
export const STATUS_TAGS = ['live_data', 'ready', 'demo', 'coming_soon'] as const
export const SAVING_KINDS = ['typical', 'estimated', 'realised', 'sample'] as const

const isoDateLike = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'as-of must be an ISO date')
  .refine((s) => Number.isFinite(Date.parse(s)), 'as-of must be a real date')

const httpsOrNull = z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'source links must be https')
  .nullable()

/** Source for a figure: named, linked where possible, and dated. */
export const FigureSourceSchema = z.object({
  name: z.string().trim().min(1, 'a figure needs a named source'),
  url: httpsOrNull,
  asOf: isoDateLike,
})

/** Source for a why-driver: named; dated when we know when (onboarding answers may not be). */
export const DriverSourceSchema = z.object({
  name: z.string().trim().min(1, 'a driver needs a named source'),
  url: httpsOrNull,
  asOf: isoDateLike.nullable(),
})

const UNITS = ['gbp', 'gbp_month', 'gbp_year', 'kg_year', 'kwh_year', 'count', 'date', 'band', 'percent', 'text'] as const

export const KeyMetricSchema = z.object({
  label: z.string().trim().min(1),
  value: z.union([z.number().finite(), z.string().trim().min(1)]),
  unit: z.enum(UNITS),
  source: FigureSourceSchema,
})

/** A Solo Focus metric. Unknown is `value: null` ("Not known yet") with the field that would fill it. */
export const MetricSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    value: z.union([z.number().finite(), z.string().trim().min(1)]).nullable(),
    unit: z.enum(UNITS),
    source: FigureSourceSchema.nullable(),
    gapField: z.string().trim().min(1).nullable(),
  })
  .superRefine((m, ctx) => {
    if (m.value !== null && m.source === null) {
      ctx.addIssue({ code: 'custom', message: `metric "${m.key}" has a value without a source`, path: ['source'] })
    }
    if (m.value === null && m.gapField === null) {
      ctx.addIssue({ code: 'custom', message: `unknown metric "${m.key}" must name the field that fills it`, path: ['gapField'] })
    }
  })

export const DriverSchema = z.object({
  factKey: z.string().trim().min(1).nullable(),
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  source: DriverSourceSchema,
})

export const ConfidenceSchema = z.object({
  level: z.enum(['high', 'medium', 'low']),
  reason: z.string().trim().min(1, 'confidence needs a reason'),
})

const RangeSchema = z
  .object({ low: z.number().finite().nonnegative(), high: z.number().finite().nonnegative() })
  .refine((r) => r.low <= r.high, 'range low must not exceed high')

export const SavingSchema = z
  .object({
    kind: z.enum(SAVING_KINDS),
    gbpRange: RangeSchema.nullable(),
    kgRange: RangeSchema.nullable(),
    source: FigureSourceSchema.nullable(),
    /** `estimated` only: how the figure was worked out, in plain words. */
    method: z.string().trim().min(1).nullable(),
    /** `realised` only: the task_evidence row and the date it was confirmed (Z11). */
    evidence: z.object({ evidenceId: z.string().trim().min(1), confirmedOn: isoDateLike }).nullable(),
  })
  .superRefine((s, ctx) => {
    if ((s.gbpRange || s.kgRange) && !s.source) {
      ctx.addIssue({ code: 'custom', message: 'a saving figure needs a source', path: ['source'] })
    }
    if (!s.gbpRange && !s.kgRange) {
      ctx.addIssue({ code: 'custom', message: 'a saving needs a £ or kg range; leave saving null when there is none', path: ['gbpRange'] })
    }
    if (s.kind === 'realised' && !s.evidence) {
      ctx.addIssue({ code: 'custom', message: 'a realised saving needs evidence', path: ['evidence'] })
    }
    if (s.kind !== 'realised' && s.evidence) {
      ctx.addIssue({ code: 'custom', message: 'only realised savings carry evidence', path: ['evidence'] })
    }
    if (s.kind === 'estimated' && !s.method) {
      ctx.addIssue({ code: 'custom', message: 'an estimated saving needs its method', path: ['method'] })
    }
  })

export const EffortSchema = z.object({
  /** Null until a category spec (Z6) states it; never guessed. */
  minutes: z.number().int().nonnegative().nullable(),
  /** 0 inform · 1 one tap · 2 summary then approve · 3 both account holders. */
  approvalTier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
})

export const OptionSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    actionId: z.string().trim().min(1).nullable(),
    impact: z.object({
      kind: z.enum(SAVING_KINDS).nullable(),
      gbpRange: RangeSchema.nullable(),
      kgRange: RangeSchema.nullable(),
      source: FigureSourceSchema.nullable(),
    }),
    effortMinutes: z.number().int().nonnegative().nullable(),
    approvalTier: EffortSchema.shape.approvalTier,
    tradeOff: z.string().trim().min(1, 'every option states its trade-off'),
    /** Disclosed whenever we could be paid for this option. */
    commission: z.object({ paid: z.boolean(), note: z.string().trim().min(1).nullable() }),
  })
  .superRefine((o, ctx) => {
    if ((o.impact.gbpRange || o.impact.kgRange) && !o.impact.source) {
      ctx.addIssue({ code: 'custom', message: `option "${o.key}" has a figure without a source`, path: ['impact', 'source'] })
    }
    if (o.impact.kind === 'realised') {
      ctx.addIssue({ code: 'custom', message: 'an option cannot claim a realised saving', path: ['impact', 'kind'] })
    }
    if (o.commission.paid && !o.commission.note) {
      ctx.addIssue({ code: 'custom', message: `option "${o.key}" is paid but does not say so`, path: ['commission', 'note'] })
    }
  })

export const GapSchema = z.object({
  questionId: z.string().trim().min(1),
  field: z.string().trim().min(1),
  whyWeAsk: z.string().trim().min(1),
})

export const ContextChipSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  asOf: isoDateLike.nullable(),
})

export const NextStepSchema = z.object({
  label: z.string().trim().min(1),
  optionKey: z.string().trim().min(1).nullable(),
  approvalTier: EffortSchema.shape.approvalTier,
})

const copy = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !s.includes('!'), 'no exclamation marks')
    .refine((s) => !/(\.\.\.|…)$/.test(s), 'no trailing ellipsis')

// ── the contract ─────────────────────────────────────────────────────────────────────────────

export const InsightCardSchema = z
  .object({
    id: z.string().trim().min(1),
    category: z.enum(INSIGHT_CATEGORIES),
    statusTag: z.enum(STATUS_TAGS),
    /** Category label shown above the headline. */
    label: z.string().trim().min(1),
    headline: copy(140),
    keyMetric: KeyMetricSchema.nullable(),
    metrics: z.array(MetricSchema).max(4),
    why: z.array(DriverSchema),
    confidence: ConfidenceSchema,
    saving: SavingSchema.nullable(),
    effort: EffortSchema,
    options: z.array(OptionSchema).max(3),
    gaps: z.array(GapSchema),
    context: z.array(ContextChipSchema),
    nextStep: NextStepSchema.nullable(),
    related: z.array(z.string().trim().min(1)).max(2),
    /** Highest evidence tier the card relies on: 1 public, 2 told us, 3 bills or bank. */
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .superRefine((c, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path })

    if (c.metrics.length > 0 && c.metrics.length < 3) issue('Solo Focus shows 3 or 4 metrics, or none', ['metrics'])
    if (c.options.length === 1) issue('offer 2 or 3 options, or none', ['options'])
    if (new Set(c.options.map((o) => o.key)).size !== c.options.length) issue('option keys must be unique', ['options'])
    if (new Set(c.metrics.map((m) => m.key)).size !== c.metrics.length) issue('metric keys must be unique', ['metrics'])
    if (c.related.includes(c.id)) issue('a card cannot be related to itself', ['related'])
    if (new Set(c.related).size !== c.related.length) issue('related cards must be distinct', ['related'])
    if (c.nextStep?.optionKey && !c.options.some((o) => o.key === c.nextStep?.optionKey)) {
      issue('next step points at an option that is not on the card', ['nextStep', 'optionKey'])
    }

    const figures = Boolean(c.keyMetric) || Boolean(c.saving) || c.metrics.some((m) => m.value !== null)

    if (c.saving?.kind === 'sample') {
      if (c.statusTag !== 'demo') issue('sample savings are always tagged demo', ['statusTag'])
      if (c.confidence.level !== 'low') issue('sample data is always low confidence', ['confidence', 'level'])
    }
    if (c.statusTag === 'demo' && c.saving?.kind !== 'sample') issue('a demo card shows a sample saving', ['saving'])
    if (c.statusTag === 'live_data' && !figures) issue('live data cards show a figure', ['keyMetric'])
    if (c.statusTag === 'coming_soon') {
      if (figures) issue('Coming soon cards show no figures', ['keyMetric'])
      if (c.options.length > 0) issue('Coming soon cards offer no options', ['options'])
      if (c.nextStep) issue('Coming soon cards have no next step', ['nextStep'])
    }
  })

export type InsightCard = z.infer<typeof InsightCardSchema>
export type InsightStatusTag = (typeof STATUS_TAGS)[number]
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number]
export type InsightSavingKind = (typeof SAVING_KINDS)[number]

// ── Coming soon fallback ─────────────────────────────────────────────────────────────────────

const COMING_SOON_HEADLINE = 'Coming soon'

/** The card shown in place of one that cannot meet the contract. Itself always valid. */
export function comingSoonCard(base: { id: string; category: InsightCategory; label: string }): InsightCard {
  return {
    id: base.id,
    category: base.category,
    statusTag: 'coming_soon',
    label: base.label.trim() || base.category.toUpperCase(),
    headline: COMING_SOON_HEADLINE,
    keyMetric: null,
    metrics: [],
    why: [],
    confidence: { level: 'low', reason: 'We do not have enough sourced data for this yet.' },
    saving: null,
    effort: { minutes: null, approvalTier: 0 },
    options: [],
    gaps: [],
    context: [],
    nextStep: null,
    related: [],
    tier: 1,
  }
}

export type InsightResolution = {
  card: InsightCard
  /** False when the input failed the contract and the Coming soon card was returned instead. */
  ok: boolean
  /** Why it failed, for logs and the CI validator. Empty when ok. */
  issues: string[]
}

function formatIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(card)'}: ${i.message}`)
}

/** Validate a candidate card. Anything that fails renders as Coming soon, never half-built. */
export function resolveInsightCard(candidate: unknown): InsightResolution {
  const parsed = InsightCardSchema.safeParse(candidate)
  if (parsed.success) return { card: parsed.data, ok: true, issues: [] }
  const raw = (candidate && typeof candidate === 'object' ? candidate : {}) as Record<string, unknown>
  const category = INSIGHT_CATEGORIES.includes(raw.category as InsightCategory) ? (raw.category as InsightCategory) : 'carbon'
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : 'unknown-card'
  const label = typeof raw.label === 'string' ? raw.label : category.toUpperCase()
  return { card: comingSoonCard({ id, category, label }), ok: false, issues: formatIssues(parsed.error) }
}

// ── from today's rec cards ───────────────────────────────────────────────────────────────────

function figureSource(
  s: SavingSource | null | undefined,
  fallbackAsOf?: string | null
): z.infer<typeof FigureSourceSchema> | null {
  const asOf = s?.date ?? fallbackAsOf ?? null
  if (!s?.name?.trim() || !asOf || !/^\d{4}-\d{2}-\d{2}/.test(asOf) || !Number.isFinite(Date.parse(asOf))) return null
  return { name: s.name.trim(), url: s.url?.startsWith('https://') ? s.url : null, asOf }
}

export type InsightFromRecOptions = {
  /** When the household's profile answers were saved, for the why-driver's as-of. */
  profileAsOf?: string | null
  /**
   * Sample bank cards carry no date on their source (lib/bank/cards.ts `savingSourceFor`). Pass the
   * date the sample data was generated to keep their badged £; without it the £ is dropped.
   */
  sampleAsOf?: string | null
}

/**
 * Lift a rec card into the contract. Keeps the rec card's source rule and adds one more:
 * a figure whose source has no date is dropped here (as-of is required in v4), and the card
 * shows its action wording instead, exactly as `resolveRecCard` does for an unsourced £.
 *
 * Rec cards have no metrics, options or gaps; those arrive from the category specs (Z6).
 */
export function insightFromRecCard(rec: RecCardModel, opts: InsightFromRecOptions = {}): InsightResolution {
  const verified =
    rec.savingGbpPerYear != null
      ? figureSource(rec.savingSource, rec.savingSource?.kind === 'sample' ? opts.sampleAsOf : null)
      : null
  const typical = !verified && rec.typicalSaving ? figureSource(rec.typicalSaving.source) : null
  const sample = rec.savingSource?.kind === 'sample' && verified != null

  const gbp = verified ? rec.savingGbpPerYear : typical ? rec.typicalSaving?.gbp ?? null : null
  const source = verified ?? typical
  const perYear = verified ? true : Boolean(rec.typicalSaving?.perYear)

  const saving =
    gbp != null && source
      ? {
          kind: (sample ? 'sample' : verified ? 'estimated' : 'typical') as InsightSavingKind,
          gbpRange: { low: gbp, high: gbp },
          kgRange: null,
          source,
          method: verified && !sample ? `From research for your area, sourced to ${source.name}.` : null,
          evidence: null,
        }
      : null

  const confidence = sample
    ? { level: 'low' as const, reason: 'Sample data, not your real payments.' }
    : verified
      ? { level: 'medium' as const, reason: 'From research for your area, not your own bills.' }
      : typical
        ? { level: 'medium' as const, reason: `A typical figure from ${typical.name}, not worked out for your home.` }
        : { level: 'medium' as const, reason: 'Matched to what you told us; no figure yet.' }

  const approvalTier = rec.primaryCta.kind === 'switch' ? 2 : rec.primaryCta.kind === 'open' ? 0 : 1

  const candidate: InsightCard = {
    id: rec.id,
    category: rec.category,
    statusTag: sample ? 'demo' : verified ? 'live_data' : 'ready',
    label: rec.label,
    headline: gbp != null && source ? rec.headline : rec.actionWording,
    keyMetric:
      gbp != null && source
        ? { label: perYear ? 'Saving a year' : 'Saving', value: gbp, unit: perYear ? 'gbp_year' : 'gbp', source }
        : null,
    metrics: [],
    why: [
      {
        factKey: null,
        label: 'Why you',
        value: rec.whyYou,
        source: {
          name: sample || rec.dependsOnBank ? 'Your bank' : 'You told us',
          url: null,
          asOf: opts.profileAsOf && Number.isFinite(Date.parse(opts.profileAsOf)) ? opts.profileAsOf : null,
        },
      },
    ],
    confidence,
    saving,
    effort: { minutes: null, approvalTier },
    options: [],
    gaps: [],
    context: [],
    nextStep: { label: rec.primaryCta.label, optionKey: null, approvalTier },
    related: [],
    tier: sample || rec.dependsOnBank ? 3 : 2,
  }
  return resolveInsightCard(candidate)
}
