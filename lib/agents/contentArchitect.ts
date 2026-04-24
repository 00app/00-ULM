/**
 * Content Architect — Gemini maps raw £/kg + profile to industrial "What / Why / How" copy for Zone cards.
 * Server-only (uses GEMINI_API_KEY). Zone UI calls POST /api/zone/content-architect.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ZoneViewModel } from '@/lib/zone/buildZoneViewModel'
import { MARCH_2026_ECONOMY, PRICE_CAP_SAVING_APRIL_1 } from '@/lib/brains/constants'

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
  baseline_title: string
  baseline_insight?: string
  source_hint?: string
  journey_answers?: Record<string, string>
  flags?: string[]
}

const MAX_HEADLINE_CHARS = 25

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
- home: money_gbp >= 6500 or flags include bus_eligible_hint → headline like "UPGRADE TO A HEAT PUMP" / BUS £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP} — cite GOV.UK.
Use April 2026 context: typical cap saving ~£${PRICE_CAP_SAVING_APRIL_1}/yr when relevant (Ofgem).`
}

function suppliedByRules(): string {
  return `suppliedBy must be a SHORT verified provider name only (no sentences): e.g. GOV.UK, OFGEM, WHICH?, ENERGY SAVING TRUST, WRAP, CARBON TRUST, OCTOPUS ENERGY, HOME ENERGY SCOTLAND. Match the strongest source for that card's claim.`
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
  return {
    headline: clampArchitectHeadline(headline),
    insight: insight.trim().replace(/\s+/g, ' ').slice(0, 280),
    actionLine: actionLine.trim().replace(/\s+/g, ' ').slice(0, 200),
    suppliedBy: suppliedBy.trim().replace(/\s+/g, ' ').slice(0, 48).toUpperCase(),
  }
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
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.22,
      maxOutputTokens: 2048,
    },
  })

  const system = `You are a Technical Lifestyle Architect for a UK climate/savings product (2026).
Format raw savings into precise instructions. Use lowercase for insight and actionLine except proper nouns (gov.uk, kWh, CO₂, £).
No marketing fluff, no emojis, no "you could save". Industrial, factual tone.
Headline = THE WHAT (max ${MAX_HEADLINE_CHARS} characters, UPPERCASE, no trailing period).
Insight = THE WHY (one technical sentence tying £ and/or kg to mechanism).
actionLine = THE HOW (one short imperative, e.g. "check eligibility on gov.uk".)
Reply with ONLY valid JSON: an object whose keys are journey_key strings (home, travel, food, shopping, money, carbon, tech, waste, holidays). Each value: { "headline", "insight", "actionLine", "suppliedBy" }.`

  const user = `${thresholdRulesBlock()}
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
  options?: { skipJourneys?: Iterable<JourneyId> }
): ZoneViewModel {
  const skip = new Set(options?.skipJourneys ?? [])
  return {
    ...vm,
    journeys: vm.journeys.map((j) => {
      if (!j.id.startsWith('journey-')) return j
      const key = j.journey_key
      if (skip.has(key)) return j
      const arch = byJourney[key]
      if (!arch) return j
      return {
        ...j,
        title: arch.headline.toLowerCase(),
        insightLabel: arch.insight,
        architectSuppliedBy: arch.suppliedBy,
        architectActionLine: arch.actionLine,
      }
    }),
  }
}
