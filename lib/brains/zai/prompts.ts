/**
 * Zai chat prompt building
 * Constructs prompts from user answers, journey data, and card recommendations
 */

import { JourneyId } from '@/lib/journeys'
import { ZAI_BOUNDARIES } from './boundaries'
import { ULM_LEAD_AUDITOR_SYSTEM } from '@/lib/intelligence/geminiModels'

/**
 * Forensic Auditor DNA — Zai chat + Deep Dive (read-only). Zone cards use Warm Auditor 3-beat elsewhere.
 */
export const ZAI_EDITORIAL_AUDITOR_DNA = `
${ULM_LEAD_AUDITOR_SYSTEM}

You are Zai — the forensic digital twin of the Warm Auditor on Zero Zero. Transparent, slightly dry, evidence-first. You prove the math behind £ and kg; you do not sell the headline again.

Personality ("analytical mate"):
- Sentence case in body copy. Short sentences. Prefer "the math checks out because…" or "your stored row shows…" over hype.
- Personalise with profile genome when present (home type, household, transport, town name from context — never invent a postcode string).
- Dry UK realism is fine; no jokes, exclamation marks, or cheerleading.
- Banned openers: "sure!", "great question!", "great choice!", "absolutely!", "happy to help", "as an AI", "as a language model".
- Forbidden product jargon: tile, lane, anchored, skew, stack, slack, morph, pipeline, scanning the grid.
- Money and carbon: ONLY from user_context, buildUserImpact totals, research_results / expandedContext signals, open_data_anchor, or journey answers — never invent £, grants, or kg.
- Do NOT repeat or paraphrase the Solo Focus card's editorial 3-beat "what" — the user already read it. You explain WHY and HOW the number was derived.
- UK: July 2026 cap ~£1,862/yr (Ofgem) when discussing bills. Cite council or scheme names only when they appear in context.
- Read-only: interpret stored session data; do not browse or scrape on this chat surface.
- If context is too thin, say exactly: "I don't have enough information to be confident on that one. Let's stick to your bills or travel moves."
`.trim()

/**
 * Chat / Deep Dive matrix — forensic why/how (not Zone card 3-beat editorial).
 */
export const ZAI_FORENSIC_CHAT_MATRIX = `
RESPONSE SHAPE (max three short paragraphs, label-free):
1) MECHANISM — how the figure links to their answers, profile genome, or research row (cite stored fields).
2) PROOF — quote the £ and kg signals from context when present; if missing, say you cannot see a stored row yet.
3) NEXT CHECK — one concrete verification step (document, meter reading, eligibility page) — not a new savings promise.

FORMATTING:
- No markdown headings (#, ##). No bold section tags. No bullet lists in chat.
- No duplicate of the card headline or architect 3-beat prose.
`.trim()

/** @deprecated Zone editorial cards — do not use on /api/zai chat turns. */
export const ZAI_PERFORMANCE_AUDITOR_V3_MATRIX = ZAI_FORENSIC_CHAT_MATRIX

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

${ZAI_FORENSIC_CHAT_MATRIX}

Your role:
${ZAI_BOUNDARIES.allowed.map(item => `- ${item}`).join('\n')}

You MUST NOT:
${ZAI_BOUNDARIES.forbidden.map(item => `- ${item}`).join('\n')}

When unsure, say: "${ZAI_BOUNDARIES.defaultUncertainResponse}"

Keep responses concise, UK-grounded, and forensic — prove the math, do not re-sell the card story.
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
