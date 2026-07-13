/**
 * Content Architect — Gemini maps raw £/kg + profile to industrial three-paragraph copy for Zone cards.
 * Server-only (uses GEMINI_API_KEY). Zone UI calls POST /api/zone/content-architect.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneViewModel } from '@/lib/logic/zone'
import {
  isAcceptableZoneJourneyHeadline,
  isLowQualityZoneHeadline,
  isZonePreviewHeadlineNoise,
  clampZoneBentoHeadline,
  MAX_ZONE_CARD_HEADLINE_WORDS,
} from '@/lib/soloFocusCopy'
import { GEMINI_PRECISION_TEMPERATURE, GEMINI_DIRECT_ZONE } from '@/lib/intelligence/geminiModels'
import {
  generateResearchText,
  hasAnyBucketLlmProvider,
  isBucketFailoverEnabled,
} from '@/lib/intelligence/aiGateway'
import {
  MARCH_2026_ECONOMY,
  PRICE_CAP_SAVING_APRIL_1,
  TRUTH_2026_MARCH,
  TRUTH_2026_JULY,
  APRIL_2026_TRUTH_PENCE,
  PRICE_CAP_SOURCE_URL,
} from '@/lib/brains/constants'
import { TRUSTED_JOURNEY_URLS } from '@/lib/zone/trustedJourneyUrls'
import { collapseDuplicateProseParagraphs, dedupeTrueTipParagraphs } from '@/lib/soloFocusCopy'
import { polishWarmAuditorProse } from '@/lib/zone/warmAuditorCopy'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import {
  sanitizeArchitectProseForJourney,
  stripContentSystemLeakage,
} from '@/lib/zone/contentProseSanitize'
import { forensicMateBannedPromptLine, ZONE_CONTENT_ARCHITECT_VOICE } from '@/lib/zone/zoneVoice'
import { shouldSkipContentArchitectLlm } from '@/lib/intelligence/scrapeBoundaries'
import { isLlmRateLimited } from '@/lib/intelligence/llmRateLimit'

export type ArchitectJourneyPayload = {
  headline: string
  insight: string
  actionLine: string
  suppliedBy: string
}

export type ContentArchitectCardInput = {
  journey_key: JourneyId
  money_gbp: number
  carbon_kg: number
  money_compact?: string
  carbon_compact?: string
  home_type?: string
  tenure?: string
  household_size?: number
  age?: string
  locality?: string
  local_grid_g_per_kwh?: number
  price_cap_gbp?: number
  baseline_title: string
  baseline_insight?: string
  source_hint?: string
  source_url?: string
  deep_link_url?: string
  verified_saving_value?: number
  offer_expiry_date?: string
  postcode?: string
  journey_answers?: Record<string, string>
  flags?: string[]
  /** Live home £/kWh from Neon (optional). */
  live_elec_gbp_per_kwh?: number
  live_gas_gbp_per_kwh?: number
  /** Ofgem/GOV citation for those rates when stored. */
  rates_citation_url?: string
  /** Intro / settings focus — leads copy emphasis; carbon_kg always surfaced. */
  profile_goal?: 'money' | 'carbon' | 'balanced'
  tone_mode?: 'bill_survival' | 'asset_optimization'
}

const MAX_HEADLINE_CHARS = 160
const DEV_SPEAK_BANNED = /\b(tile|tiles|lane|lanes|anchored|anchor|ui shell|card rail|component)\b/gi
const TONE_FILLER_BANNED = /\b(cosy|cozy|haven|havens|humming|quietly|nesting|navigating|perfect|simple|gently|nicely|lovely|friendly nudge|little win)\b/gi
const TECHNICAL_JARGON_BANNED =
  /\b(aviation factors?|tariff pressure|emissions factor|policy signal|defra data|pathway numbers)\b/gi

/** Stable short fingerprint for sessionStorage cache keys (profile + answers + £/kg). */
export function architectCacheFingerprint(payload: unknown): string {
  const str = JSON.stringify(payload)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
}

/** When Content Architect returns a valid headline, prefer it on grid faces (journeys + tips). */
export function shouldPreferArchitectHeadline(
  currentTitle: string,
  archHeadline: string,
  journeyKey: JourneyId,
  options?: { streamPending?: boolean }
): boolean {
  const arch = clampArchitectHeadline(archHeadline)
  if (!arch || isLowQualityZoneHeadline(arch)) return false
  if (!isAcceptableZoneJourneyHeadline(journeyKey, arch)) return false
  const cur = currentTitle.trim()
  if (!cur || /^COMPUTING\s+—/i.test(cur)) return true
  if (options?.streamPending) return true
  if (isZonePreviewHeadlineNoise(cur) || isLowQualityZoneHeadline(cur)) return true
  if (!isAcceptableZoneJourneyHeadline(journeyKey, cur)) return true
  return false
}

export function architectHeadlineForZoneCard(
  archHeadline: string,
  fallback: string,
  journeyKey: JourneyId
): string {
  const arch = clampArchitectHeadline(archHeadline)
  if (!arch || isLowQualityZoneHeadline(arch)) {
    return clampZoneBentoHeadline(fallback, journeyKey)
  }
  return clampZoneBentoHeadline(arch, journeyKey)
}

export function clampArchitectHeadline(s: string): string {
  const t = s
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/[^A-Z0-9£%&+\-./\s]/g, '')
  if (t.length <= MAX_HEADLINE_CHARS) return t
  return t.slice(0, MAX_HEADLINE_CHARS).trim()
}

function marketSeedsBlock(): string {
  return `UK market seeds (weave into headline when baseline_title, journey_answers, or money_gbp support it; stay factual, ≤${MAX_HEADLINE_CHARS} chars):
- travel / money: petrol or diesel price pressure, duty changes, or fare caps when the card implies car use or commuting.
- home / carbon / tech: Ofgem price-cap direction (up or down), April timing, typical dual-fuel £/yr when bills or heating are in play.
- food / shopping: only when tied to the mechanism (seasonal wholesale, retail basket), not generic slogans.
Example shapes (must match inputs; do not invent statistics): "PETROL PRICES UP 2%", "ENERGY CAP DROPS IN APRIL", "CAP TYPICAL SAVE £${PRICE_CAP_SAVING_APRIL_1}".`
}

function thresholdRulesBlock(): string {
  return `Category thresholds (prefer these headlines when savings fit; still output every journey_key):
- food: money_gbp > 100 → headline like "SWITCH TO SEASONAL VEG" unless a stronger UK policy beats it.
- travel: money_gbp > 1000 → headline like "CLAIM EV INSTALL GRANT" (gov.uk chargepoint grant pathway).
- waste: money_gbp > 50 → headline like "START FOOD COMPOSTING" (WRAP-aligned).
- home: insulation, draughts, fabric — never heat-pump grant amounts on home cards.
Use April 2026 context: typical cap saving ~£${PRICE_CAP_SAVING_APRIL_1}/yr when relevant (Ofgem).`
}

function suppliedByRules(): string {
  return `suppliedBy must be a SHORT verified provider name only (no sentences): e.g. GOV.UK, OFGEM, WHICH?, ENERGY SAVING TRUST, WRAP, CARBON TRUST, OCTOPUS ENERGY, HOME ENERGY SCOTLAND. Match the strongest source for that card's claim.`
}

function lockedFactsBlock(): string {
  const catalogue = Object.entries(TRUSTED_JOURNEY_URLS)
    .map(([k, u]) => `${k}: ${u}`)
    .join('\n')
  return `LOCKED UK FACTS (April–June 2026 — use in paragraph 2 for national policy; do NOT invent different caps, unit pence, grant £ amounts, or new URLs):
- Government heat pump grant (England & Wales): up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP} for air-source heat pumps; oil/LPG properties may access up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026} from July 2026. Plain English only — say "heat pump grant", not BUS.
- Typical price-cap headline about £${TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP}/yr; bill composition shift ~£${TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP} (green levy) off dual-fuel statements.
- Reference unit rates: electricity ~${APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH}p/kWh, gas ~${APRIL_2026_TRUTH_PENCE.GAS_PER_KWH}p/kWh. Ofgem cap hub: ${PRICE_CAP_SOURCE_URL}
- OZEV flats/renters chargepoint support £${TRUTH_2026_MARCH.EV_GRANT_NEW_GBP} per eligible socket (April 2026 framing).
- When live_elec_gbp_per_kwh/live_gas_gbp_per_kwh are present on a home card, treat them as the user's grounded bill maths and mention rates_citation_url if provided.
- Paragraph 3 MUST tell the user to use the HTTPS source_url (or deep_link_url) supplied for THAT card in the JSON input — never fabricate government links.
Canonical HTTPS fallbacks by journey (for suppliedBy alignment only):\n${catalogue}`
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (fence ? fence[1] : t).trim()
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function normalisePayload(
  key: string,
  v: unknown
): ArchitectJourneyPayload | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const headline = typeof o.headline === 'string' ? o.headline : ''
  const insight = typeof o.insight === 'string' ? o.insight : ''
  const actionLine = typeof o.actionLine === 'string' ? o.actionLine : ''
  const suppliedBy = typeof o.suppliedBy === 'string' ? o.suppliedBy : ''
  if (!headline || !insight || !actionLine || !suppliedBy) return null
  const journey = key as JourneyId
  return {
    headline: clampArchitectHeadline(stripContentSystemLeakage(headline)),
    insight: normaliseInsightEditorialSandwich(insight, journey),
    actionLine: stripContentSystemLeakage(actionLine.trim().replace(/\s+/g, ' ')).slice(0, 200),
    suppliedBy: suppliedBy.trim().replace(/\s+/g, ' ').slice(0, 48).toUpperCase(),
  }
}

function replaceDevSpeak(text: string): string {
  return text.replace(DEV_SPEAK_BANNED, 'audit')
}

function stripFillerTone(text: string): string {
  return text.replace(TONE_FILLER_BANNED, '').replace(TECHNICAL_JARGON_BANNED, 'your bills')
}

function scrubBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').trim()
}

function normaliseInsightEditorialSandwich(raw: string, journeyKey?: JourneyId): string {
  const stripped = stripContentSystemLeakage(
    stripFillerTone(replaceDevSpeak(raw))
  )
    .split('\n')
    .map((line) => scrubBulletPrefix(line))
    .join('\n')
    .trim()
  const polished = polishWarmAuditorProse(stripped)
  if (polished) {
    if (journeyKey) {
      return sanitizeArchitectProseForJourney(journeyKey, polished) ?? polished
    }
    return polished
  }
  const paragraphs = dedupeTrueTipParagraphs(
    stripped
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
  )
  const deDuped = paddedUniqueParagraphs(paragraphs)
  const padded = [
    deDuped[0] ?? 'Your home setup is still leaking cash and carbon each year.',
    deDuped[1] ?? 'April 2026 UK schemes can shrink that waste if you match the fix to your setup.',
    deDuped[2] ?? 'Take one step this week via the linked source and lock the saving on your row.',
  ]
  const joined = forceThreeSentenceInsight(
    collapseDuplicateProseParagraphs(padded.slice(0, 3).join('\n\n')).slice(0, 1200)
  )
  if (journeyKey) {
    return sanitizeArchitectProseForJourney(journeyKey, joined) ?? joined
  }
  return joined
}

function forceThreeSentenceInsight(text: string): string {
  const compact = text
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = compact
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const defaults = [
    'Your current setup leaks measurable money and carbon each year.',
    'The 2026 UK baseline defines the practical fix for this category.',
    'Use the linked source now to execute the action this week.',
  ]
  const picked = [parts[0] || defaults[0], parts[1] || defaults[1], parts[2] || defaults[2]].map((s) =>
    /[.!?]$/.test(s) ? s : `${s}.`
  )
  return picked.join('\n\n')
}

function paddedUniqueParagraphs(paragraphs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of paragraphs) {
    const t = p.trim()
    if (!t) continue
    const k = t.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w£%./\s-]/g, '')
    if (k.includes('green pension funds hitting 20')) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/**
 * Single journey — same batch pipeline (one item).
 */
export async function generateCardContext(
  journey_key: JourneyId,
  data_points: Omit<ContentArchitectCardInput, 'journey_key'>
): Promise<ArchitectJourneyPayload | null> {
  const batch = await generateCardContextsBatch([{ journey_key, ...data_points }])
  return batch[journey_key] ?? null
}

function formatCompactGbp(n: number): string {
  const v = Math.max(0, Math.round(n))
  if (v >= 1000) return `£${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `£${v}`
}

function formatCompactCarbonKg(n: number): string {
  const v = Math.max(0, Math.round(n))
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}t`
  return `${v}kg`
}

function mechanicalPayoffParagraph(c: ContentArchitectCardInput, url: string): string {
  const moneyLabel = c.money_compact?.trim() || formatCompactGbp(c.money_gbp)
  const carbonLabel = c.carbon_compact?.trim() || formatCompactCarbonKg(c.carbon_kg)
  const goal = c.profile_goal ?? 'balanced'
  if (goal === 'money') {
    return `Target ~${moneyLabel} and ~${carbonLabel} CO₂e — open ${url} this week and execute one audited step.`
  }
  if (goal === 'carbon') {
    return `Cut ~${carbonLabel} CO₂e (~${moneyLabel} on bills) — open ${url} this week and execute one audited step.`
  }
  return `Target ~${moneyLabel} and ~${carbonLabel} CO₂e — open ${url} this week and execute one audited step.`
}

function profileGoalPromptBlock(cards: ContentArchitectCardInput[]): string {
  const seed = cards.find((c) => c.profile_goal)
  if (!seed?.profile_goal) return ''
  const goal = seed.profile_goal
  const tone = seed.tone_mode ?? 'bill_survival'
  const lead =
    goal === 'money'
      ? 'Lead paragraph 3 with £ savings; always include carbon_kg (kg/t CO₂e) in the same beat — never omit carbon.'
      : goal === 'carbon'
        ? 'Lead paragraph 3 with kg/t CO₂e; include £ where money_gbp is provided.'
        : 'Paragraph 3 gives equal weight to £ and kg/t CO₂e.'
  const toneLine =
    tone === 'asset_optimization'
      ? 'bill_survival off — stress ROI, export, smart tariffs; deprioritise means-tested grant copy.'
      : 'bill_survival on — stress cap relief, supplier switch, monthly bill cuts.'
  return `
Profile goal emphasis (mandatory):
- profile_goal: ${goal}; ${lead}
- tone_mode: ${tone}; ${toneLine}
- UI always stamps both £ and carbon on cards — insight copy must honour both figures regardless of goal.`
}

function mechanicalArchitectPayload(c: ContentArchitectCardInput): ArchitectJourneyPayload {
  const locality = c.locality?.trim() || 'your area'
  const moneyLabel = c.money_compact?.trim() || formatCompactGbp(c.money_gbp)
  const carbonLabel = c.carbon_compact?.trim() || formatCompactCarbonKg(c.carbon_kg)
  const headlineRaw =
    c.baseline_title?.trim() ||
    `${moneyLabel} ${c.journey_key.replace(/_/g, ' ')} audit ${locality}`.slice(0, MAX_HEADLINE_CHARS)
  const url = c.source_url?.trim() || TRUSTED_JOURNEY_URLS[c.journey_key]
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toUpperCase()
    } catch {
      return 'GOV.UK'
    }
  })()
  const insightSeed = [
    c.baseline_insight?.trim() ||
      `${locality} still leaks measurable cash and carbon on this row until you match the fix to your setup.`,
    'April 2026 UK cap and grant frames define the practical lever — stay conservative and tie claims to the linked source.',
    mechanicalPayoffParagraph(c, url),
  ].join('\n\n')
  return {
    headline: clampArchitectHeadline(
      clampZoneBentoHeadline(headlineRaw, c.journey_key)
    ),
    insight: normaliseInsightEditorialSandwich(insightSeed, c.journey_key),
    actionLine: `Open ${host} and execute this week.`.slice(0, 200),
    suppliedBy: (c.source_hint?.trim() || host).slice(0, 48).toUpperCase(),
  }
}

function buildMechanicalArchitectBatch(
  cards: ContentArchitectCardInput[]
): Partial<Record<JourneyId, ArchitectJourneyPayload>> {
  const out: Partial<Record<JourneyId, ArchitectJourneyPayload>> = {}
  for (const c of cards) {
    out[c.journey_key] = mechanicalArchitectPayload(c)
  }
  return out
}

/**
 * Batch all Zone category cards in one Gemini call (lower latency + consistent voice).
 */
export async function generateCardContextsBatch(
  cards: ContentArchitectCardInput[]
): Promise<Partial<Record<JourneyId, ArchitectJourneyPayload>>> {
  const key = process.env.GEMINI_API_KEY?.trim()
  const skipGemini =
    process.env.BUCKET_SKIP_GEMINI === '1' || process.env.GEMINI_FREE_TIER === '1'
  const useBucket = isBucketFailoverEnabled() && hasAnyBucketLlmProvider()
  const canDirectGemini = Boolean(key) && !skipGemini
  const out: Partial<Record<JourneyId, ArchitectJourneyPayload>> = {}
  if (cards.length === 0) return out
  if (shouldSkipContentArchitectLlm() || isLlmRateLimited()) {
    return buildMechanicalArchitectBatch(cards)
  }
  if (!useBucket && !canDirectGemini) return buildMechanicalArchitectBatch(cards)

  const lifestyleShift = cards.some((c) => c.flags?.includes('lifestyle_shift'))
  const lifestyleBlock = lifestyleShift
    ? `
Lifestyle shift / pattern arbitrage: prioritise behavioural shifts (rail vs flight, EV swap, local holidays, meal patterns) over generic grant homepages. Paragraph 3 must reference a deep-linked https portal — never a site root or 404 page.`
    : ''

  const system = `${ZONE_CONTENT_ARCHITECT_VOICE}
${profileGoalPromptBlock(cards)}
${lifestyleBlock}
${forensicMateBannedPromptLine()}
Market accuracy beats creative writing. If any value is uncertain, stay conservative and tie claims to provided source_url/source_hint.
No emojis. No repeated sentences. Vary paragraph 1 openers across cards — do not reuse the same lead rhythm on every journey.
STRICT CATEGORY BOUNDARIES (mandatory — violating a boundary invalidates the card):
- Each card's copy must match journey_key only.
- utilities = fuel mix, tariff, supplier, standing charges (no BUS, no loft insulation).
- home = fabric, draughts, heating habits (no BUS grant £ amounts).
- solar = solar panels and export only (no heat pump grants, no boilers, no e-bike).
- travel/holidays/food/shopping/water/waste/money/tech/carbon each need a distinct mechanism — never reuse the same opening sentence across cards.
Banned in all user-facing text: parenthetical system notes, "(official cap pathway)", "your live pathway is", raw variable names, or conditional dev notes.
Never invent gov.uk paths (no "great british insulation scheme" URLs). Paragraph 3 must name one concrete action this week and reference the HTTPS source_url for that card.
source_url and deep_link_url in input are already absolute https:// — echo them in paragraph 3, never bare domains like "ofgem.gov.uk".
Absolute voice constraints:
- No dev-speak words: tile, lane, anchored, component, card rail.
- No filler words or softeners: cosy/cozy, haven, quietly, humming, gently, lovely.
- No bullet points or numbered list formatting.
- Never use repetitive generic line: "Green pension funds hitting 20% ROI in 2026."
- Keep each journey insight unique in wording and mechanism.
Keep headline <= ${MAX_HEADLINE_CHARS} chars, uppercase, no trailing period.
Insight must follow the 3-beat structure (three paragraphs, blank line between) — see ZONE_WARM_AUDITOR_THREE_BEAT above.
Paragraph 1 must open with locality (town name) when the card JSON includes locality — never the raw postcode string.
Paragraph 2 must not cite heat pump grant £ amounts — grants is not a card category. No acronyms (BUS, ECO4, MCS) in output copy.
Paragraph 3 holds the single £/kg payoff and the https source_url action — do not repeat payoff figures from paragraph 1.
Use compact figures only: £1.4k / 0.3t style, never long-form integers in prose.
When verified_saving_value is provided, cite it in paragraph 3 only (compact £) and mention offer_expiry_date when present.
actionLine = one short imperative.
Reply with ONLY valid JSON: an object whose keys are journey_key strings (home, utilities, solar, travel, holidays, food, shopping, money, tech, water, waste, carbon). Each value: { "headline", "insight", "actionLine", "suppliedBy" }.`

  const user = `${lockedFactsBlock()}

${thresholdRulesBlock()}
${marketSeedsBlock()}
${suppliedByRules()}

Input cards (JSON):
${JSON.stringify(cards).slice(0, 12000)}

Return a single JSON object whose keys are exactly those journey_key values present in the input. No markdown fences, no prose.`

  const prompt = `${system}\n\n${user}`

  try {
    let text: string
    if (useBucket) {
      const result = await generateResearchText({
        prompt,
        tag: 'content-architect',
        tier: 'article',
        maxOutputTokens: useBucket ? 1536 : 4096,
        temperature: GEMINI_PRECISION_TEMPERATURE,
      })
      text = result.text
    } else {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(key!)
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_ZONE_MODEL?.trim() || GEMINI_DIRECT_ZONE,
        generationConfig: {
          temperature: GEMINI_PRECISION_TEMPERATURE,
          maxOutputTokens: 4096,
        },
      })
      text = (await model.generateContent(prompt)).response.text()
    }
    const parsed = extractJsonObject(text)
    if (!parsed) return out

    for (const c of cards) {
      const k = c.journey_key
      const row = normalisePayload(k, parsed[k])
      if (row) out[k] = row
    }
  } catch {
    return buildMechanicalArchitectBatch(cards)
  }

  if (Object.keys(out).length === 0) {
    return buildMechanicalArchitectBatch(cards)
  }

  return out
}

export function applyArchitectEnrichment(
  vm: ZoneViewModel,
  byJourney: Partial<Record<JourneyId, ArchitectJourneyPayload>>,
  options?: { skipJourneys?: Iterable<JourneyId>; claimUrls?: Partial<Record<JourneyId, string>> }
): ZoneViewModel {
  const skip = new Set(options?.skipJourneys ?? [])
  const claimUrls = options?.claimUrls ?? {}
  return {
    ...vm,
    journeys: vm.journeys.map((j) => {
      if (!j.id.startsWith('journey-')) return j
      const key = j.journey_key
      if (skip.has(key)) return j
      const arch = byJourney[key]
      const rawUrl = claimUrls[key]?.trim()
      const https = rawUrl ? sanitizeZoneOfferUrl(rawUrl, key) : undefined
      let next = j
      if (arch) {
        const useArchitectHeadline = shouldPreferArchitectHeadline(j.title, arch.headline, key, {
          streamPending: j.streamPending,
        })
        const faceTitle = useArchitectHeadline
          ? architectHeadlineForZoneCard(arch.headline, j.title, key)
          : j.title
        next = {
          ...j,
          title: faceTitle,
          streamPending: useArchitectHeadline ? false : j.streamPending,
          insightLabel: arch.insight,
          architectSuppliedBy: arch.suppliedBy,
          architectActionLine: arch.actionLine,
          source_name: arch.suppliedBy,
        }
      }
      if (!https) return next
      return {
        ...next,
        claimOfferUrl: https,
        actions: next.actions
          ? { ...next.actions, learnUrl: https, actionUrl: https }
          : { actionType: 'learn', learnUrl: https, actionUrl: https },
      }
    }),
    tips: vm.tips.map((tip) => {
      const key = tip.journey_key
      if (!key || skip.has(key)) return tip
      const arch = byJourney[key]
      if (!arch) return tip
      const useArchitectHeadline = shouldPreferArchitectHeadline(tip.title, arch.headline, key)
      const faceTitle = useArchitectHeadline
        ? architectHeadlineForZoneCard(arch.headline, tip.title, key)
        : tip.title
      const insightParagraphs = arch.insight
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
      return {
        ...tip,
        title: faceTitle,
        explanation: insightParagraphs.length >= 2 ? insightParagraphs : tip.explanation,
        architectSuppliedBy: arch.suppliedBy || tip.architectSuppliedBy,
        architectActionLine: arch.actionLine,
        source_name: arch.suppliedBy || tip.source_name,
      }
    }),
  }
}
