/**
 * Solo Focus v1.8.3 — shared headline + insight/RESULT asterisk logic (one template, dual entry).
 */

import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'

/** Headline = max 5 words for visual balance (recommendation title from Zone card). */
export function headlineFromTitle(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
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
      `${titleHint.trim()} compresses the signal on this tile into one decisive move you can execute without re-reading the whole grid.`
    )
  }
  const padA =
    'Your answers and postcode context refine the estimate as verified rows land, so treat this copy as live guidance that tightens with each save.'
  const padB =
    'The Zone keeps stacking evidence behind the headline: fewer words, higher leverage, and a clear next tap when you are ready to move.'
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
  const s1 = `This ${j} tile is anchored to about £${m.toLocaleString('en-GB')} annual cash slack and roughly ${c} kg CO₂e once behaviour catches the headline.`
  const s2 = iceFirst
    ? 'Your profile skews combustion-first, so we are weighting mpg hygiene, pump discipline, and maintenance wins ahead of EV salary-sacrifice plays until your answers show a battery-led commute.'
    : 'Your profile skews cleaner miles, so we are weighting tariff-shaped charging, route efficiency, and grant-backed upgrades that compound with each verified save.'
  const s3 =
    'Open the official programme page to lock eligibility, then keep the Solo Focus loop running so the next morph can tighten numbers against your postcode stack.'
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
}): string {
  const scraped = composeScrapedInsightDescription(args.morphParts, 3).trim()
  if (scraped && !GENERIC_SCRAPED.test(scraped)) return scraped
  // Real-content lock: never inject synthetic narrative when source-backed copy is absent.
  return 'Open the verified source to view live guidance.'
}
