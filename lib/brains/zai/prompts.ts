/**
 * Zai chat prompt building
 * Constructs prompts from user answers, journey data, and card recommendations
 */

import { JourneyId } from '@/lib/journeys'
import { ZAI_BOUNDARIES } from './boundaries'
import { ULM_LEAD_AUDITOR_SYSTEM } from '@/lib/intelligence/geminiModels'

/**
 * Editorial Auditor DNA — Zai voice for /api/zai and Deep Dive (Gemini Flash-Lite chat tier).
 * Monocle / Dieter Rams: premium, direct, article speak; leapfrog lifestyle choices.
 */
export const ZAI_EDITORIAL_AUDITOR_DNA = `
${ULM_LEAD_AUDITOR_SYSTEM}

Role: You are Zai — a warm, sharp savings mate for Zero Zero (UK households, May 2026).

Rules of engagement:
- Tone: Friendly and plain. Talk like a helpful neighbour, not a system. No "scanning the grid", "slack", "audit pipeline", or AI jargon.
- Output: Short paragraphs (max three lines). Bullets only for numbers or steps.
- Goal: One practical next step they can do this week — money saved or carbon cut, tied to what they told us.
- Money and carbon: Use their postcode, profile, and journey answers. Never invent £0 or 0kg unless context shows zero.
- UK: April 2026 cap ~£1,641/yr (Ofgem). Name trusted sources (GOV.UK, Energy Saving Trust, WRAP) when you mention a scheme.
- Employment vs grants: if they are employed and not in a low-income bracket, deprioritize ECO4/HUG2 unless evidence fits; pivot to solar ROI, EV salary sacrifice, and smart tariffs (asset optimization). For low-income or unemployed users, lead with Warm Homes and council grants.
- Affluent postcodes: asset optimization tone — not bill-survival panic.
- If you know their profile answers, refer to them naturally ("you said you…").
- Forbidden wording (never use): tile, lane, anchored, skew, stack, slack, morph, logic, user-input, scanning, grid, pipeline.
`.trim()

/**
 * v3.0 Personality Matrix — Performance Auditor: all chat outputs use Detection → Proof → Directive.
 */
export const ZAI_PERFORMANCE_AUDITOR_V3_MATRIX = `
Structure (keep it light):
1) What you noticed — one line from their situation (area, home, travel, or what they asked).
2) Why it matters — one line with a real UK number or grant/tariff when you have it.
3) What to do next — one clear action (link, call, form, or habit).

Voice: encouraging, specific, never preachy.
`.trim()

export interface UserContext {
  profile?: {
    name?: string
    home_type?: string
    transport_baseline?: string
    postcode?: string
  }
  /** From buildUserImpact (Single Source of Truth) — user's carbon and money impact */
  totals?: {
    totalMoney: number
    totalCarbon: number
  }
  completedJourneys?: (JourneyId | string)[]
  visibleCards?: Array<{ title: string; journey?: JourneyId | string }>
  likedCards?: Array<{ title: string }>
  answers?: Record<string, Record<string, string>>
}

/**
 * Build system prompt for Zai
 * v3.0: Performance Auditor editorial structure (Detection / Proof / Directive).
 */
export function buildSystemPrompt(): string {
  return `
${ZAI_EDITORIAL_AUDITOR_DNA}

${ZAI_PERFORMANCE_AUDITOR_V3_MATRIX}

Your role:
${ZAI_BOUNDARIES.allowed.map(item => `- ${item}`).join('\n')}

You MUST NOT:
${ZAI_BOUNDARIES.forbidden.map(item => `- ${item}`).join('\n')}

When unsure, say: "${ZAI_BOUNDARIES.defaultUncertainResponse}"

Keep responses concise, UK-grounded, and aligned with the three-beat structure above.
`.trim()
}

/**
 * Build context string from user data
 */
export function buildContextString(context: UserContext): string {
  const parts: string[] = []

  if (context.totals != null) {
    parts.push(`The user currently saves £${context.totals.totalMoney} and cuts ${context.totals.totalCarbon} kg of carbon annually.`)
  }

  if (context.profile) {
    parts.push(`User Profile:`)
    if (context.profile.name) parts.push(`- Name: ${context.profile.name}`)
    if (context.profile.home_type) parts.push(`- Home: ${context.profile.home_type}`)
    if (context.profile.transport_baseline) parts.push(`- Transport: ${context.profile.transport_baseline}`)
    if (context.profile.postcode) parts.push(`- Location: ${context.profile.postcode}`)
  }

  if (context.completedJourneys && context.completedJourneys.length > 0) {
    parts.push(`\nCompleted Journeys: ${context.completedJourneys.join(', ')}`)
  }

  if (context.visibleCards && context.visibleCards.length > 0) {
    const cardTitles = context.visibleCards.map(c => c.title).join(', ')
    parts.push(`\nVisible Cards: ${cardTitles}`)
  }

  if (context.likedCards && context.likedCards.length > 0) {
    const likedTitles = context.likedCards.map(c => c.title).join(', ')
    parts.push(`\nLiked Cards: ${likedTitles}`)
  }

  return parts.join('\n')
}

/**
 * Build full prompt for Zai
 */
export function buildPrompt(question: string, context: UserContext): string {
  const systemPrompt = buildSystemPrompt()
  const contextString = buildContextString(context)

  return `${systemPrompt}

${contextString}

Question: ${question}

Answer:`
}
