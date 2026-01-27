/**
 * Zai chat prompt building
 * Constructs prompts from user answers, journey data, and card recommendations
 */

import { JourneyId } from '@/lib/journeys'
import { ZAI_BOUNDARIES } from './boundaries'

export interface UserContext {
  profile?: {
    name?: string
    home_type?: string
    transport_baseline?: string
    postcode?: string
  }
  completedJourneys?: (JourneyId | string)[] // Allow string[] for compatibility
  visibleCards?: Array<{ title: string; journey?: JourneyId | string }>
  likedCards?: Array<{ title: string }>
  answers?: Record<string, Record<string, string>> // journey_id -> question_key -> answer
}

/**
 * Build system prompt for Zai
 */
export function buildSystemPrompt(): string {
  return `
You are Zai, a sustainability guide for Zero Zero.

Your role:
${ZAI_BOUNDARIES.allowed.map(item => `- ${item}`).join('\n')}

You MUST NOT:
${ZAI_BOUNDARIES.forbidden.map(item => `- ${item}`).join('\n')}

When unsure, say: "${ZAI_BOUNDARIES.defaultUncertainResponse}"

Keep responses:
- Simple and clear
- Grounded in facts
- Focused on small actions
- Reference cards the user sees when relevant
`.trim()
}

/**
 * Build context string from user data
 */
export function buildContextString(context: UserContext): string {
  const parts: string[] = []

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
