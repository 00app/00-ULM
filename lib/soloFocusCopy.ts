/**
 * Solo Focus v1.8.3 — shared headline + insight/RESULT asterisk logic (one template, dual entry).
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'
import { buildAuditorNarrativeParagraphs } from '@/lib/zone/auditorNarrative'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'

function coerceJourneyId(id: string): JourneyId {
  return (JOURNEY_ORDER.includes(id as JourneyId) ? id : 'home') as JourneyId
}

/** Headline = max N words (defaults to 8 for Zone cards) with ellipsis when clipped. */
export function headlineFromTitle(title: string, maxWords = 8): string {
  const words = title
    .split(/\s+/)
    .filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}...`
}

/**
 * Insight / supporting copy: wrap the first sentence only with leading and trailing `*`.
 * Remaining sentences are appended unchanged.
 */
export function wrapInsightFirstSentenceWithAsterisks(text: string): string {
  const t = text.trim()
  if (!t) return t
  const m = t.match(/^(.+?[.!?])(\s+[\s\S]*)?$/)
  if (m) {
    const first = m[1].trim()
    const rest = (m[2] ?? '').trim()
    const wrapped = `*${first}*`
    return rest ? `${wrapped} ${rest}` : wrapped
  }
  return `*${t}*`
}

/** RESULT supporting copy: sanitize agentic text, then `* {text} *` (v1.8.3 lock). */
export function wrapResultSupportingAsterisks(text: string): string {
  const t = sanitizeAgentMarkdown(text, 2400).trim()
  if (!t) return t
  return `* ${t} *`
}

/**
 * v2.3 — Expand thin insight/morph lines into 2–3 sentences of agentic prose (no API call).
 * Keeps the first sentence(s) from the source when present; pads with deterministic context glue.
 */
export function enrichSoloFocusInsightBody(raw: string, titleHint?: string): string {
  const base = raw.trim()
  const sentences: string[] = []
  if (base) {
    const parts = base
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    sentences.push(...parts)
  }
  if (sentences.length === 0 && titleHint?.trim()) {
    sentences.push(
      `${titleHint.trim()} turns today’s waste pattern into one decisive move you can execute immediately.`
    )
  }
  const padA =
    'Your answers and postcode context refine the estimate as verified updates land, so treat this as live guidance that tightens with each save.'
  const padB =
    'The Zone keeps evidence behind the headline: fewer words, higher leverage, and a clear next tap when you are ready to move.'
  while (sentences.length < 2) {
    sentences.push(sentences.length === 1 ? padA : padB)
  }
  return sentences.slice(0, 3).join(' ')
}

/** v2.9 — Solo Focus bridge: up to `maxSentences` real sentences from scraped/source fields only (no synthetic pad). */
export function composeScrapedInsightDescription(
  parts: Array<string | null | undefined>,
  maxSentences = 3
): string {
  const raw = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\bin your area\.?/gi, '')
    .trim()
  if (!raw) return ''
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length === 0) return ''
  return sentences.slice(0, Math.max(1, maxSentences)).join(' ')
}

const GENERIC_SCRAPED = /answer a few questions|personalise your|insights from your area/i

/** Three-sentence agentic fallback when scraped / bridge copy is empty or placeholder-only. */
export function buildSoloFocusAgenticImpactFallback(args: {
  journeyId: string
  headline: string
  moneyGbp: number
  carbonKg: number
  transportBaseline?: string | null
  travelFuelType?: string | null
}): string {
  const j = args.journeyId.replace(/-/g, ' ')
  const m = Math.max(0, Math.round(args.moneyGbp))
  const c = Math.max(0, Math.round(args.carbonKg))
  const fuel = (args.travelFuelType ?? '').toUpperCase()
  const baseline = (args.transportBaseline ?? '').toUpperCase()
  const iceFirst =
    fuel === 'PETROL' ||
    fuel === 'DIESEL' ||
    fuel === 'HYBRID' ||
    (['CAR', 'MIX'].includes(baseline) && fuel !== 'ELECTRIC')
  const s1 = `Your ${j} pattern is leaking about £${formatMoneyValue(m)} a year and roughly ${formatCarbonValue(c)} CO₂e until this action is locked in.`
  const s2 = iceFirst
    ? 'April 2026 is still expensive for combustion-heavy routines, so this move prioritises lower fuel burn, cleaner maintenance habits, and verified provider offers first.'
    : 'April 2026 still rewards efficient electric and mixed-mile routines, so this move prioritises tariff timing, cleaner routes, and grant-backed upgrades.'
  const s3 =
    'Use the primary action below to execute the verified next step now, then continue the Solo Focus loop for the next gain.'
  return `${s1} ${s2} ${s3}`
}

/** Prefer scraped-only sentences; otherwise deterministic 3-sentence impact story. */
export function resolveSoloFocusInsightDisplay(args: {
  morphParts: Array<string | null | undefined>
  journeyId: string
  headline: string
  moneyGbp: number
  carbonKg: number
  transportBaseline?: string | null
  travelFuelType?: string | null
  /** v35.0 — postcode string for Detection paragraph */
  userPostcode?: string | null
  /** v35.0 — display name for Proof paragraph */
  sourceDisplayName?: string | null
  /** v42.8 — strip duplicate "In [locality]" lines (header already shows VERIFIED — LOCALITY). */
  auditHeaderLocality?: string | null
}): string {
  const scraped = composeScrapedInsightDescription(args.morphParts, 3).trim()
  const toParagraphs = (text: string): string[] => {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (sentences.length >= 3) return sentences.slice(0, 3)
    if (sentences.length === 2) return [sentences[0], sentences[1], 'Open the verified source to complete this action.']
    if (sentences.length === 1) {
      return [
        sentences[0],
        `This maps to roughly £${formatMoneyValue(Math.max(0, Math.round(args.moneyGbp)))} and ${formatCarbonValue(Math.max(0, Math.round(args.carbonKg)))} in this audit pathway.`,
        'Use the verified source to execute the action plan this week.',
      ]
    }
    return []
  }
  if (scraped && !GENERIC_SCRAPED.test(scraped)) {
    const joined = toParagraphs(scraped).join('\n\n')
    return pruneDuplicateLocalityInsight(joined, args.headline, args.auditHeaderLocality, args.journeyId)
  }
  const j = coerceJourneyId(args.journeyId)
  const pc = (args.userPostcode ?? '').trim() || 'your postcode'
  const src = (args.sourceDisplayName ?? '').trim() || 'UK Government'
  const fallback = buildAuditorNarrativeParagraphs({
    userPostcode: pc,
    sourceName: src,
    journey: j,
    moneyGbp: args.moneyGbp,
    carbonKg: args.carbonKg,
    locality: '',
  }).join('\n\n')
  return pruneDuplicateLocalityInsight(fallback, args.headline, args.auditHeaderLocality, args.journeyId)
}

/** Remove redundant locality / travel-prefixed lines so expanded copy does not repeat the audit header. */
function pruneDuplicateLocalityInsight(
  text: string,
  headline: string,
  auditLocality: string | null | undefined,
  journeyId: string
): string {
  const loc = (auditLocality ?? '').trim()
  const locNorm = loc.toUpperCase().replace(/\s+/g, ' ')
  const headUp = headline.toUpperCase()
  const travelContext = journeyId === 'travel' || headUp.includes('TRAVEL')
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out = parts.filter((p) => {
    const u = p.replace(/\s+/g, ' ').toUpperCase()
    if (travelContext && /^TRAVEL IN\b/.test(u)) return false
    if (locNorm.length >= 4 && /^IN\s+/i.test(p.trim())) {
      const locShort = locNorm.slice(0, Math.min(locNorm.length, 28))
      if (u.includes(locShort) && p.length < 200) return false
    }
    return true
  })
  return out.join('\n\n')
}
