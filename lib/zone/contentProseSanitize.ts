/**
 * Zone copy sanitizer — strips system/pathway leakage and enforces journey-topic boundaries.
 */

import type { JourneyId } from '@/lib/journeys'

const LEAKAGE_PATTERNS: RegExp[] = [
  /\s*\([^)]*(?:official\s+cap\s+pathway|cap\s+pathway|live\s+pathway)[^)]*\)/gi,
  /\byour\s+live\s+pathway\s+is\b[^.!?]*[.!?]?/gi,
  /\b(?:official\s+cap\s+pathway|live\s+pathway)\b/gi,
  /\bEngland\s*&\s*Wales\s+heat\s+pump\s+support\s*\([^)]+\)/gi,
]

/** Strip parenthetical system notes and internal pathway labels from user-facing copy. */
export function stripContentSystemLeakage(text: string): string {
  let t = text
  for (const re of LEAKAGE_PATTERNS) {
    t = t.replace(re, ' ')
  }
  return t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Ensure stored source / CTA URLs are absolute HTTPS links. */
export function ensureAbsoluteHttpsUrl(raw: string | undefined | null): string | undefined {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return undefined
  if (/^https:\/\//i.test(trimmed)) return trimmed
  if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:/i, 'https:')
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  const host = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0] ?? ''
  if (/^[a-z0-9][-a-z0-9.]*\.[a-z]{2,}/i.test(host) && !/\s/.test(host)) {
    return `https://www.${host}`
  }
  return undefined
}

const JOURNEY_PROSE_BANNED: Partial<Record<JourneyId, RegExp>> = {
  solar: /\b(?:boiler\s+upgrade|bus\b|heat\s*pump|gas\s+boiler|ofgem\s+price\s*cap|april\s+2026\s+ofgem|dual-fuel|e-bike|ebike)\b/i,
  travel: /\b(?:loft\s+top-?up|loft\s+insulation|boiler\s+upgrade|heat\s*pump|ofgem\s+price\s*cap|april\s+cap\s+signal)\b/i,
  food: /\b(?:boiler\s+upgrade|heat\s*pump|ofgem\s+price\s*cap|solar\s+panel|loft\s+insulation)\b/i,
  shopping: /\b(?:boiler\s+upgrade|heat\s*pump|ofgem\s+price\s*cap|solar\s+panel)\b/i,
  water: /\b(?:boiler\s+upgrade|heat\s*pump|ofgem\s+price\s*cap|solar\s+panel|ev\s+chargepoint)\b/i,
  waste: /\b(?:boiler\s+upgrade|heat\s*pump|ofgem\s+price\s*cap|solar\s+panel)\b/i,
  holidays: /\b(?:boiler\s+upgrade|loft\s+insulation|ofgem\s+price\s*cap|e-?bike|ebike)\b/i,
  tech: /\b(?:boiler\s+upgrade|bus\b|loft\s+insulation|ofgem\s+price\s*cap)\b/i,
  money: /\b(?:boiler\s+upgrade|loft\s+insulation|heat\s*pump|shower\s+head|e-?bike|ebike)\b/i,
  grants: /\b(?:solar\s+panel\s+install|feed-in\s+tariff|mcs\s+certified\s+only)\b/i,
  home: /\b(?:e-bike\s+scheme|cycle\s+to\s+work\s+loan|bus\s+grant\s+only)\b/i,
  utilities: /\b(?:e-bike|food\s+compost|wrap\s+uk)\b/i,
  carbon: /\b(?:e-bike\s+scheme|meal\s+planner)\b/i,
}

export function proseViolatesJourneyCategory(journey: JourneyId, prose: string): boolean {
  const re = JOURNEY_PROSE_BANNED[journey]
  return re ? re.test(prose) : false
}

const BOILERPLATE_PROSE_RE =
  /\b(?:open the verified source(?:\s+link)?\s+below to complete this action(?:\s+and lock in the saving)?|open the verified source to complete this action|use the link below to execute the verified offer|use the primary action below to claim|use the verified source to execute the action plan|execute the audited step|we treat the ~£|optimization plan|green funding frameworks)\b/i

function stripBoilerplateFromParagraph(paragraph: string): string {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const kept = sentences.filter((s) => !BOILERPLATE_PROSE_RE.test(s))
  return kept.join(' ').trim()
}

/** Sanitize architect prose before Neon persistence or Solo Focus display. */
export function sanitizeArchitectProseForJourney(journey: JourneyId, prose: string | null | undefined): string | null {
  if (!prose?.trim()) return null
  let t = stripContentSystemLeakage(prose)
  t = t
    .split(/\n\s*\n/)
    .map((p) => stripBoilerplateFromParagraph(stripContentSystemLeakage(p.trim())))
    .filter(Boolean)
    .join('\n\n')
  if (!t || proseViolatesJourneyCategory(journey, t)) return null
  return t
}
