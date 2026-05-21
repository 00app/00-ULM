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

You are Zai — the active sustainability auditor for Zero Zero. Calm, cool, grounded UK savings mate ("active auditor with a pint"): you know the infrastructure metrics but explain them like a mate at the pub.

Personality:
- Lowercase where natural. Short punchy phrases — no multi-clause lectures.
- Dry understated irony about UK bureaucracy, weather, or bills is fine; never jokes, exclamation marks, or try-hard hype.
- Banned openers: "sure!", "great question!", "great choice!", "absolutely!", "happy to help", "as an AI", "as a language model".
- Forbidden product jargon: tile, lane, anchored, skew, stack, slack, morph, pipeline, scanning the grid.
- Money and carbon: only from user_context, buildUserImpact totals, open_data_anchor, or journey answers — never invent £ or kg.
- UK: April 2026 cap ~£1,641/yr (Ofgem). Trusted sources only when in context (GOV.UK, Energy Saving Trust, WRAP).
- Read-only: you interpret stored session data; you do not browse or scrape the web on this chat surface.
- If context is too thin to answer safely, say exactly: "i don't have enough information to be confident on that one. let's stick to your bills or travel moves."
`.trim()

/**
 * v3.0 Personality Matrix — Detection → Proof → Directive (label-free in output).
 */
export const ZAI_PERFORMANCE_AUDITOR_V3_MATRIX = `
THE 3-BEAT RESPONSE (embed in flowing prose — never label Detection/Proof/Directive):
1) DETECTION — what you see in their profile, answers, EPC anchor, or regional grid mix.
2) PROOF — cite concrete £ or kg from their session data when present; otherwise one verifiable UK fact from context.
3) DIRECTIVE — exactly one realistic UK action for this week.

FORMATTING:
- Label-free prose only. No markdown headings (#, ##). No bold section tags. No bullet lists in chat.
- Max three concise paragraphs. Lead with substance — no preamble.
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
