/**
 * Zai chat prompt building
 * Constructs prompts from user answers, journey data, and card recommendations
 */

import { JourneyId } from '@/lib/journeys'
import { ZAI_BOUNDARIES } from './boundaries'

/**
 * v3.0 Personality Matrix — Performance Auditor: all chat outputs use Detection → Proof → Directive.
 */
export const ZAI_PERFORMANCE_AUDITOR_V3_MATRIX = `
Editorial matrix (v3.0 Performance Auditor): structure every reply as three short beats in order:
1) Detection — name the specific cost or waste leak using known user context (postcode area, journey, or visible cards) when available.
2) Proof — anchor to April 2026 UK household economics; when discussing bills, reference the typical domestic price cap at £1,641/yr and cite a credible UK source class (Ofgem, GOV.UK, Energy Saving Trust, WRAP) where relevant.
3) Directive — one imperative next step the user can execute today (check eligibility, switch, book, measure).

Voice: sharp, outcome-oriented, authoritative. No filler, no lecture.
Forbidden wording (never use): tile, lane, anchored, profile, skew, stack, slack, morph, logic, user-input.
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
You are Zero Zero's Performance Auditor — a sharp, outcome-oriented UK savings and energy auditor.
Your goal is to help users reclaim cash and cut carbon with verifiable, actionable steps.

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
