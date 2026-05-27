/**
 * Content Architect — Gemini maps raw £/kg + profile to industrial three-paragraph copy for Zone cards.
 * Server-only (uses GEMINI_API_KEY). Zone UI calls POST /api/zone/content-architect.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { isLowQualityZoneHeadline } from '@/lib/soloFocusCopy'
import {
  MARCH_2026_ECONOMY,
  PRICE_CAP_SAVING_APRIL_1,
  TRUTH_2026_MARCH,
  APRIL_2026_TRUTH_PENCE,
  PRICE_CAP_SOURCE_URL,
} from '@/lib/brains/constants'
import { TRUSTED_JOURNEY_URLS } from '@/lib/zone/trustedJourneyUrls'
import { collapseDuplicateProseParagraphs } from '@/lib/soloFocusCopy'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import {
  sanitizeArchitectProseForJourney,
  stripContentSystemLeakage,
} from '@/lib/zone/contentProseSanitize'

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
}

const MAX_HEADLINE_CHARS = 160
const DEV_SPEAK_BANNED = /\b(tile|tiles|lane|lanes|anchored|anchor|ui shell|card rail|component)\b/gi

/** Stable short fingerprint for sessionStorage cache keys (profile + answers + £/kg). */
export function architectCacheFingerprint(payload: unknown): string {
  const str = JSON.stringify(payload)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
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
- grants: money_gbp >= 6500 or flags include bus_eligible_hint → headline like "CLAIM BUS HEAT PUMP GRANT" — air-source £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP}; oil/LPG uplift £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026} from July 2026 — cite GOV.UK only on grants cards.
- home: insulation, draughts, fabric — never BUS or heat-pump grant amounts on home cards.
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
- Boiler Upgrade Scheme (England & Wales): flat £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP} for air-source heat pumps; oil/LPG properties may access £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026} from July 2026. Never cite £5,000 BUS amounts.
- Typical price-cap headline about £${TRUTH_2026_MARCH.APRIL_PRICE_CAP_TYPICAL_GBP}/yr; bill composition shift ~£${TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP} (green levy) off dual-fuel statements.
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

function scrubBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').trim()
}

function normaliseInsightEditorialSandwich(raw: string, journeyKey?: JourneyId): string {
  const stripped = stripContentSystemLeakage(
    replaceDevSpeak(raw)
  )
    .split('\n')
    .map((line) => scrubBulletPrefix(line))
    .join('\n')
    .trim()
  const paragraphs = stripped
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const deDuped = paddedUniqueParagraphs(paragraphs)
  const padded = [
    deDuped[0] ?? 'Performance audit detects a measurable leak in your local setup.',
    deDuped[1] ?? 'April 2026 market conditions keep this waste expensive if left untouched.',
    deDuped[2] ?? 'Tap RECLAIM now to convert this audit finding into a live action.',
  ]
  const joined = collapseDuplicateProseParagraphs(padded.slice(0, 3).join('\n\n')).slice(0, 1200)
  if (journeyKey) {
    return sanitizeArchitectProseForJourney(journeyKey, joined) ?? joined
  }
  return joined
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

/**
 * Batch all Zone category cards in one Gemini call (lower latency + consistent voice).
 */
export async function generateCardContextsBatch(
  cards: ContentArchitectCardInput[]
): Promise<Partial<Record<JourneyId, ArchitectJourneyPayload>>> {
  const key = process.env.GEMINI_API_KEY?.trim()
  const out: Partial<Record<JourneyId, ArchitectJourneyPayload>> = {}
  if (!key || cards.length === 0) return out

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_ARTICLE_MODEL?.trim() || 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  })

  const lifestyleShift = cards.some((c) => c.flags?.includes('lifestyle_shift'))
  const lifestyleBlock = lifestyleShift
    ? `
Lifestyle shift / pattern arbitrage: prioritise behavioural shifts (rail vs flight, EV swap, local holidays, meal patterns) over generic grant homepages. Paragraph 3 must reference a deep-linked https portal — never a site root or 404 page.`
    : ''

  const system = `You are Zai — a warm UK family savings mate (2026). Write like a sharp friend at the kitchen table, not a regulator bulletin.
Market accuracy beats creative writing. If any value is uncertain, stay conservative and tie claims to provided source_url/source_hint.
${lifestyleBlock}
Format raw savings into plain next steps. No emojis. No "you could save". No repeated sentences across paragraphs.
STRICT CATEGORY BOUNDARIES (mandatory — violating a boundary invalidates the card):
- Each card's copy must match journey_key only. If journey_key is grants and the topic is e-bike schemes, do NOT mention gas boilers, heat pumps, or Ofgem cap maths unless the grant is explicitly BUS/heat-pump.
- utilities = fuel mix, tariff, supplier, standing charges (no BUS, no loft insulation).
- home = fabric, draughts, heating habits (no BUS grant £ amounts).
- grants = BUS, ECO, heat pump funding only (no solar panel install copy, no generic cap essays).
- solar = PV, export, MCS installs only (no BUS, no boilers, no e-bike).
- travel/holidays/food/shopping/water/waste/money/tech/carbon each need a distinct mechanism — never reuse the same opening sentence across cards.
Banned in all user-facing text: parenthetical system notes, "(official cap pathway)", "your live pathway is", raw variable names, or conditional dev notes.
Never invent gov.uk paths (no "great british insulation scheme" URLs). Paragraph 3 must name one concrete action this week and reference the HTTPS source_url for that card.
source_url and deep_link_url in input are already absolute https:// — echo them in paragraph 3, never bare domains like "ofgem.gov.uk".
Absolute voice constraints:
- No dev-speak words: tile, lane, anchored, component, card rail.
- No bullet points or numbered list formatting.
- Never use repetitive generic line: "Green pension funds hitting 20% ROI in 2026."
- Keep each journey insight unique in wording and mechanism.
Headline must follow this exact structure:
[ACTION] £[VALUE] FROM YOUR [HOMETYPE] IN [LOCALITY] — [SPECIFIC_REASON]
Keep headline <= ${MAX_HEADLINE_CHARS} chars, uppercase, no trailing period.
Insight must be exactly 3 paragraphs separated by blank lines:
Paragraph 1 (Detection): identify the specific leak in [User_Location], explicitly stating compact money figure.
Paragraph 2 (2026 Context): ground the waste in April 2026 price-cap reality and local grid context.
Paragraph 3 (The Bridge): direct the user to press RECLAIM and tie it to deep_link_url/source_url/source_hint.
Use compact figures only: £1.4k / 0.3t style, never long-form integers in prose.
When verified_saving_value is provided, cite it explicitly in compact £ format and mention offer_expiry_date when present.
Always reference locality and postcode context when provided.
actionLine = one short imperative.
Reply with ONLY valid JSON: an object whose keys are journey_key strings (home, utilities, grants, solar, travel, holidays, food, shopping, money, tech, water, waste, carbon). Each value: { "headline", "insight", "actionLine", "suppliedBy" }.`

  const user = `${lockedFactsBlock()}

${thresholdRulesBlock()}
${marketSeedsBlock()}
${suppliedByRules()}

Input cards (JSON):
${JSON.stringify(cards).slice(0, 12000)}

Return a single JSON object whose keys are exactly those journey_key values present in the input. No markdown fences, no prose.`

  try {
    const text = (await model.generateContent(`${system}\n\n${user}`)).response.text()
    const parsed = extractJsonObject(text)
    if (!parsed) return out

    for (const c of cards) {
      const k = c.journey_key
      const row = normalisePayload(k, parsed[k])
      if (row) out[k] = row
    }
  } catch {
    return out
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
        const archHeadline = clampArchitectHeadline(arch.headline)
        const isComputingPlaceholder = /^COMPUTING\s+—/i.test(j.title)
        const useArchitectHeadline =
          Boolean(archHeadline) &&
          !isLowQualityZoneHeadline(archHeadline) &&
          (isComputingPlaceholder || j.streamPending)
        next = {
          ...j,
          title: useArchitectHeadline ? archHeadline : j.title,
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
  }
}
