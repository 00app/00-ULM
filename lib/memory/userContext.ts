/**
 * Memory Bridge — builds user_context.md content from Profile + Journey Answers.
 * Zai and server agents read this for personalised search and advice.
 * Flush after Profile completion and when contextual answers update.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'

export interface ProfileForMemory {
  name?: string
  postcode?: string
  household?: string
  home_type?: string
  transport_baseline?: string
  age?: string
  goal?: string
  /** STUDENT | EMPLOYED | BETWEEN_JOBS — lifestyle-architect / financial-physics pivot */
  employment_status?: string
}

export interface MemoryFlushPayload {
  profile?: ProfileForMemory
  journeyAnswers: Record<JourneyId, Record<string, string>>
  /** Optional: goals or interests from Expanded View / contextual Q&A */
  activeGoals?: string[]
  /** Card-to-question loop: key-value from followUp.targetField → selected option */
  contextUpdate?: Record<string, string>
}

/** Map journey answers to a short, readable summary for the memory file */
function journeySummary(
  journeyKey: JourneyId,
  answers: Record<string, string>
): string[] {
  const lines: string[] = []
  const entries = Object.entries(answers).filter(([, v]) => v != null && String(v).trim() !== '')
  if (entries.length === 0) return lines
  const parts = entries.map(([k, v]) => `${k}: ${v}`).join(', ')
  lines.push(`- ${journeyKey}: ${parts}`)
  return lines
}

/**
 * Build User Carbon Profile + Active Goals section as Markdown.
 * Used to build "Search Seeds" and by Zai for personalised advice.
 */
export function buildUserContextMarkdown(payload: MemoryFlushPayload): string {
  const { profile, journeyAnswers, activeGoals, contextUpdate } = payload
  const sections: string[] = []

  sections.push('# User Carbon Profile')
  sections.push('')

  if (profile?.postcode) {
    sections.push(`- Location: ${profile.postcode}`)
  }
  if (profile?.home_type) {
    sections.push(`- Home Type: ${profile.home_type}`)
  }
  if (profile?.household) {
    sections.push(`- Household: ${profile.household}`)
  }
  if (profile?.goal) {
    sections.push(`- Goal: ${profile.goal}`)
  }
  if (profile?.employment_status) {
    sections.push(`- Employment: ${profile.employment_status}`)
  }

  // Home journey → heating / energy
  const homeAnswers = journeyAnswers?.home ?? {}
  if (Object.keys(homeAnswers).length > 0) {
    const energy = homeAnswers.energy_type ?? homeAnswers.heating
    if (energy) sections.push(`- Heating: ${energy}`)
    const boiler = homeAnswers.boiler_age ?? homeAnswers.heating_age
    if (boiler) sections.push(`- Boiler/Heating age: ${boiler}`)
    const cost = homeAnswers.monthly_cost
    if (cost) sections.push(`- Monthly energy cost: £${cost}`)
  }

  // Travel journey → commute
  const travelAnswers = journeyAnswers?.travel ?? {}
  if (Object.keys(travelAnswers).length > 0) {
    const transport = travelAnswers.primary_transport ?? travelAnswers.fuel_type
    if (transport) sections.push(`- Commute: ${travelAnswers.distance_amount ?? '?'} miles/day (${transport})`)
  }

  // Interests / goals from journey keys or explicit activeGoals
  const interestJourneys = JOURNEY_ORDER.filter((jid) => {
    const a = journeyAnswers?.[jid] ?? {}
    return Object.keys(a).length > 0
  })
  if (interestJourneys.length > 0) {
    sections.push(`- Interests: ${interestJourneys.map((j) => j.charAt(0).toUpperCase() + j.slice(1)).join(', ')}`)
  }

  sections.push('')
  sections.push('# Active Goals')
  sections.push('')

  if (activeGoals && activeGoals.length > 0) {
    activeGoals.forEach((g) => sections.push(`- ${g}`))
  } else {
    sections.push('- Reduce carbon and save money (default)')
  }

  if (contextUpdate && Object.keys(contextUpdate).length > 0) {
    sections.push('')
    sections.push('# Contextual (from card follow-up)')
    sections.push('')
    Object.entries(contextUpdate).forEach(([k, v]) => sections.push(`- ${k}: ${v}`))
  }

  sections.push('')
  return sections.join('\n')
}
