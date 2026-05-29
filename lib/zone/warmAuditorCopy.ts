/**
 * Warm Auditor — shared post-processing for Gemini architect prose (Zone + research).
 */

import { dedupeTrueTipParagraphs, stripArchitectEmbeddedSectionTitles } from '@/lib/soloFocusCopy'
import { stripContentSystemLeakage } from '@/lib/zone/contentProseSanitize'

/** UK outward + inward postcodes — strip from user-facing prose (town name only). */
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi

const JARGON_HUMANIZE: [RegExp, string][] = [
  [/\baviation factors?\b/gi, 'flight habits'],
  [/\btariff pressure\b/gi, 'bill swings'],
  [/\bpolicy signal\b/gi, 'rule change'],
  [/\bemissions factor\b/gi, 'carbon maths'],
  [/\bdefra\b/gi, 'official UK data'],
  [/\bofgem cap signal\b/gi, 'price cap shift'],
  [/\bpathway numbers\b/gi, 'your numbers'],
  [/\boptimization plan\b/gi, 'savings plan'],
  [/\bleverage\b/gi, 'use'],
  [/\boptimi[sz]e your journey\b/gi, 'cut waste'],
]

const AI_FILLER_RE =
  /^(?:sure!|absolutely!|of course!|i can help|here is your|as an ai|great news!|don't worry!)\s*/i

export function stripUkPostcodesFromProse(text: string): string {
  return text.replace(UK_POSTCODE_RE, 'your area').replace(/\byour area,\s*your area\b/gi, 'your area')
}

export function humanizeWarmAuditorJargon(text: string): string {
  let t = text
  for (const [re, replacement] of JARGON_HUMANIZE) {
    t = t.replace(re, replacement)
  }
  return t
}

/** Strip markdown, apologies, postcodes; dedupe payoff; enforce three paragraphs. */
export function polishWarmAuditorProse(raw: string, maxWordsPerParagraph = 40): string | undefined {
  if (!raw?.trim()) return undefined
  let t = stripArchitectEmbeddedSectionTitles(raw)
  t = stripContentSystemLeakage(t)
  t = humanizeWarmAuditorJargon(t)
  t = stripUkPostcodesFromProse(t)
  t = t.replace(/\*\*/g, '').replace(/^#{1,6}\s+/gm, '').replace(AI_FILLER_RE, '').trim()

  const parts = dedupeTrueTipParagraphs(
    t
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
  ).map((p) => clipWords(p, maxWordsPerParagraph))

  if (parts.length >= 3) return parts.slice(0, 3).join('\n\n')
  if (parts.length === 2) {
    return undefined
  }
  if (parts.length === 1) {
    const sentences = parts[0]
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
    if (sentences.length >= 3) {
      const third = Math.ceil(sentences.length / 3)
      return [
        clipWords(sentences.slice(0, third).join(' '), maxWordsPerParagraph),
        clipWords(sentences.slice(third, third * 2).join(' '), maxWordsPerParagraph),
        clipWords(sentences.slice(third * 2).join(' '), maxWordsPerParagraph),
      ].join('\n\n')
    }
  }
  return undefined
}

function clipWords(p: string, maxWords: number): string {
  const words = p.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return p.trim()
  return words.slice(0, maxWords).join(' ')
}
