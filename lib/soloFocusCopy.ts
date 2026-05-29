/**
 * Solo Focus v1.8.3 — shared headline + insight/RESULT asterisk logic (one template, dual entry).
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { sanitizeAgentMarkdown, stripMarkdownForProseDisplay } from '@/lib/agents/zeroHunterMarkdown'
import {
  buildAuditorNarrativeParagraphs,
  isGenericAuditorProofParagraph,
  payoffSentence,
} from '@/lib/zone/auditorNarrative'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { MAX_SOLO_FOCUS_PROSE_BLOCKS } from '@/lib/zone/zoneVoice'

function coerceJourneyId(id: string): JourneyId {
  return (JOURNEY_ORDER.includes(id as JourneyId) ? id : 'home') as JourneyId
}

const UK_POSTCODE_INLINE_RE = /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/gi

const EXPANDED_TITLE_TARIFF_NOISE_RE =
  /\b\d+\.?\d*\s*p\s*\/\s*(?:kwh|day)\b|\b(?:standard|variable)\s+tariff\b|\bregulatory\s+window\b|\bprice\s+cap\b/gi

const EXPANDED_TITLE_REPORT_PREFIX_RE =
  /\b(?:household\s+)?energy\s*(?:&|and)\s*travel\s+audit\b|\b(?:energy\s+)?audit\s+report\b|\bregional\s+(?:energy\s+)?profile\b/gi

/** Strip postcodes, tariff dumps, audit report prefixes, and date noise from Solo Focus / expanded H1s. */
export function stripExpandedCardTitleNoise(raw: string): string {
  let t = raw.trim()
  t = t.replace(/\*{2,3}/g, '').replace(/_{2,3}/g, '').replace(/\s+/g, ' ').trim()
  t = t.replace(UK_POSTCODE_INLINE_RE, ' ')
  t = t.replace(EXPANDED_TITLE_TARIFF_NOISE_RE, ' ')
  t = t.replace(EXPANDED_TITLE_REPORT_PREFIX_RE, ' ')
  t = t.replace(/\b(?:your\s+)?zone\s+pattern\s+is\s+learned(?:\s+on)?\b/gi, ' ')
  t = t.replace(/\b(?:AUDIT|REPORT|REGULATORY|WINDOW)\b/gi, ' ')
  t = t.replace(/\s*\([^)]*(?:updated|as at|revised)[^)]*\)\s*$/i, '').trim()
  t = t.replace(/\s*\(\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2},?\s*\d{4}\s*\)\s*$/i, '').trim()
  t = t.replace(/^(?:did you know\??|consider (?:this|that)\.?\s*|fun fact:?\s*|here'?s (?:the thing|what you need to know):?\s*)/i, '').trim()
  const colonIdx = t.indexOf(':')
  if (colonIdx >= 0 && colonIdx < t.length - 2) {
    const after = t.slice(colonIdx + 1).trim()
    if (after.length >= 3 && !isZonePreviewHeadlineNoise(after)) t = after
  }
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

const ZONE_PREVIEW_NOISE_RE =
  /\b(?:BN\d|POSTCODE|REGULATORY|AUDIT|REPORT|REGIONAL|PROFILE|DNO|UKPN|APRIL\s*2026|ENERGY\s+AUDIT|LITTLEHAMPTON|ARUN|SOUTH\s+EAST|DISTRIB|STANDING\s+CHARGE|UNIT\s+RATE|KWH|KWH\/|PRICE\s+CAP|OFgem|GOVERNMENT\s+DATA|ZONE\s+PATTERN|PATTERN\s+IS\s+LEARNED|PATTERN\s+LEARNED)\b/i

const ZONE_HEADLINE_JARGON_RE =
  /\b(?:your\s+)?(?:zone\s+)?pattern\s+(?:is\s+)?learned\b/i

const ZONE_HEADLINE_FILLER_WORDS = new Set([
  'right',
  'now',
  'this',
  'month',
  'near',
  'you',
  'today',
  'locally',
  'in',
  'uk',
])

const ENERGY_AUDIT_DEBRIS_WORDS = new Set([
  'electricity',
  'electric',
  'energy',
  'gas',
  'kwh',
  'tariff',
  'audit',
  'report',
  'regulatory',
  'household',
])

/** Headlines that are only stripped energy-audit tokens (e.g. "ELECTRICITY" after noise removal). */
export function isEnergyAuditDebrisHeadline(text: string): boolean {
  const words = splitHeadlineWords(text).map((w) => w.replace(/^\*+|\*+$/g, '').toLowerCase())
  if (words.length === 0) return true
  if (words.length <= 2 && words.every((w) => ENERGY_AUDIT_DEBRIS_WORDS.has(w))) return true
  return false
}

/** Non-home journeys must not show home-energy audit fragments on the bento face. */
const JOURNEY_HEADLINE_TOPIC_CONFLICT: Partial<Record<JourneyId, RegExp>> = {
  solar:
    /\b(?:april\s*cap\s*signal|ofgem\s+price|heat\s*pump|boiler\s+upgrade|bus\b|dual-fuel|gas\s+boiler|e-bike|ebike)\b/i,
  grants: /\b(?:april\s*cap\s*signal|solar\s+panel|loft\s+top-?up|e-?bike|ebike)\b/i,
  utilities: /\b(?:e-bike|ebike|food\s+compost|loft\s+top-?up|boiler\s+upgrade\s+scheme)\b/i,
  home: /\b(?:e-bike\s+scheme|ebike|cycle\s+to\s+work|solar\s+export)\b/i,
  water: /\b(?:electric(?:ity)?|gas\b|kwh|tariff|boiler|heat\s*pump|solar\s+panel|ofgem|octopus|grid\s+intensity)\b/i,
  food: /\b(?:electric(?:ity)?|kwh|tariff|boiler|heat\s*pump|loft\s+insulation|april\s*cap)\b/i,
  shopping: /\b(?:electric(?:ity)?|kwh|tariff|boiler|heat\s*pump|april\s*cap)\b/i,
  waste: /\b(?:electric(?:ity)?|kwh|tariff|boiler|heat\s*pump|april\s*cap)\b/i,
  holidays: /\b(?:loft|insulation|boiler|kwh|tariff|heat\s*pump|april\s*cap|e-?bike|ebike)\b/i,
  money: /\b(?:shower|bath|rainwater|loft\s+insulation|april\s*cap|e-?bike|ebike|boiler\s+upgrade)\b/i,
  tech: /\b(?:shower|bath|rainwater|water\s+meter|flush|april\s*cap\s*signal)\b/i,
  travel: /\b(?:shower|bath|rainwater|water\s+meter|loft\s+insulation|april\s*cap)\b/i,
  carbon: /\b(?:e-bike|ebike|meal\s+planner|food\s+compost)\b/i,
}

export function headlineConflictsWithJourney(journey: JourneyId, headline: string): boolean {
  const re = JOURNEY_HEADLINE_TOPIC_CONFLICT[journey]
  return re ? re.test(headline) : false
}

/** Bento / Neon title gate — journey topic + debris + existing quality checks. */
export function isAcceptableZoneJourneyHeadline(journey: JourneyId, headline: string): boolean {
  const prepared = prepareZoneHeadlineSource(headline)
  if (!prepared || isLowQualityZoneHeadline(prepared)) return false
  if (isEnergyAuditDebrisHeadline(prepared)) return false
  if (headlineConflictsWithJourney(journey, prepared)) return false
  return true
}

/** True when a headline is still report metadata, not a user-facing insight. */
export function isZonePreviewHeadlineNoise(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 3) return true
  if (t.length > 52) return true
  if (ZONE_PREVIEW_NOISE_RE.test(t)) return true
  if (/\b[A-Z]{1,2}\d[A-Z0-9]?\s?\d[A-Z]{2}\b/i.test(t)) return true
  if (/\d+\.?\d*\s*p(?:\/|\s*)?(?:kwh|day)\b/i.test(t)) return true
  if (/\(\s*£\s*0\.\d+/i.test(t)) return true
  if (/energy\s+audit/i.test(t)) return true
  return false
}

/**
 * Strips technical noise for small Zone grid / Saving Tips preview cards.
 * e.g. "ELECTRICITY AUDIT: BN17 7DW" → tighter insight label.
 */
export function cleanZonePreviewHeadline(raw: string): string {
  let t = raw.replace(/\*{2,3}/g, '').replace(/^\*+\s*|\s*\*+$/g, '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/\b[A-Z]{1,2}\d[A-Z0-9]?\s?\d[A-Z]{2}\b/gi, '')
  t = t.replace(
    /\b(?:energy\s+audit(?:\s+report)?|audit\s+report|regional\s+(?:energy\s+)?profile|grant\s+eligibility)[:\s-]*/gi,
    ''
  )
  t = t.replace(
    /\b(?:AUDIT|RESULT|REPORT|OUTLOOK|ENERGY|ELECTRIC(?:ITY)?|REGULATORY|WINDOW|HOUSEHOLD|POSTCODE|REGIONAL|PROFILE|SOURCE)\b:?/gi,
    ''
  )
  if (t.includes(':')) {
    const parts = t.split(':').map((p) => p.trim()).filter(Boolean)
    const meat = parts.find((p) => p.length >= 6 && !isZonePreviewHeadlineNoise(p))
    if (meat) t = meat
    else if (parts.length > 0) t = parts[parts.length - 1]!
  }
  t = t.replace(/\s+/g, ' ').trim()
  if (isEnergyAuditDebrisHeadline(t)) return ''
  if (isZonePreviewHeadlineNoise(t)) {
    const action = t.match(
      /\b(loft|solar|tariff|radiator|boiler|grant|insulation|commute|kwh|seal|foil|switch|upgrade|ev|heat pump)[^.!?]{0,36}/i
    )
    if (action?.[0] && !isZonePreviewHeadlineNoise(action[0])) {
      t = action[0].trim()
    } else {
      return ''
    }
  }
  return t.slice(0, 45)
}

/** Drop report-style headers / metadata blocks from architect prose (jump to insight). */
export function stripProseReportLead(text: string): string {
  let t = text.trim()
  t = t.replace(
    /^(?:#{1,6}\s*|\*{1,3}\s*)?(?:energy\s+audit(?:\s+and\s+grant\s+eligibility)?\s+report|grant\s+eligibility\s+report|regional\s+energy\s+audit)[^\n]*\n*/i,
    ''
  )
  const lines = t.split('\n')
  while (lines.length > 0) {
    const L = lines[0]!.trim()
    if (
      !L ||
      /^(?:#{1,6}\s*)?\*{0,3}\s*(?:location|status|regulatory\s+window)\s*:/i.test(L) ||
      /^\*{1,3}\s*[^*\n]{0,80}\*{1,3}\s*$/.test(L)
    ) {
      lines.shift()
      continue
    }
    break
  }
  return lines.join('\n').trim()
}

/** Remove cheap engagement openers from auditor / architect paragraphs (prompt hygiene). */
/** UI / template filler — never show in Solo Focus (DB rows may still carry legacy closes). */
const BOILERPLATE_PROSE_RE =
  /\b(?:open the verified source(?:\s+link)?\s+below to complete this action(?:\s+and lock in the saving)?|open the verified source to complete this action|use the link below to execute the verified offer|use the primary action below to claim|use the verified source to execute the action plan)\b/i

const GENERIC_SPRING_HEADLINE_RE =
  /\bone\s+clear\s+move\s+near\s+you\b.*\b(?:bill\s+savings|locks\s+real)\b/i

/** Legacy agent scaffolding — strip before Solo Focus display. */
const MECHANICAL_SCAFFOLD_PROSE_RE =
  /\b(?:execute the audited step|execute the verified step|we treat the ~£|optimization plan|green funding frameworks|at today'?s pathway numbers|fresh audit:|live partner offer unavailable|footprint liabilities|hedges capital liabilities)\b/i

const THIN_FLUFF_PROSE_RE =
  /^your\s+\w+\s+is\s+high[- ]?value\.?$/i

export function isMechanicalScaffoldParagraph(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (THIN_FLUFF_PROSE_RE.test(t)) return true
  if (t.length < 28 && /^execute the\b/i.test(t)) return true
  return MECHANICAL_SCAFFOLD_PROSE_RE.test(t)
}

export function isBoilerplateProseParagraph(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return (
    BOILERPLATE_PROSE_RE.test(t) ||
    isCtaBridgeParagraph(t) ||
    isMechanicalScaffoldParagraph(t) ||
    isGenericAuditorProofParagraph(t)
  )
}

/** Expanded/bento headline filler reused across journeys when Neon title is thin. */
export function isGenericSpringHeadline(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (GENERIC_SPRING_HEADLINE_RE.test(t)) return true
  const key = compactAlnumKey(t)
  const genericKey = compactAlnumKey('one clear move near you that locks real bill savings this spring')
  if (key.length < 18 || genericKey.length < 18) return false
  const n = Math.min(36, key.length, genericKey.length)
  return key.slice(0, n) === genericKey.slice(0, n)
}

/** Prose already states GBP — metrics row owns the stamp; omit payoffSentence lines. */
export function proseContainsMoneyStamp(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/£\s*\d/.test(t)) return true
  if (/\b\d[\d,]*(?:\.\d+)?\s*(?:gbp|pounds?)\b/i.test(t)) return true
  if (/\bsave(?:s|d)?\s+(?:about\s+)?£/i.test(t)) return true
  if (/\b(?:£|gbp)[\d,]+.*(?:\/|per)\s*year\b/i.test(t)) return true
  return false
}

export function shouldOmitPayoffLine(architectProse: string | null | undefined): boolean {
  return proseContainsMoneyStamp((architectProse ?? '').trim())
}

function paragraphRepeatsPayoffStamp(text: string, journey: JourneyId, moneyGbp: number, carbonKg: number): boolean {
  const key = compactAlnumKey(text)
  if (key.length < 20) return false
  const stamp = compactAlnumKey(payoffSentence(journey, moneyGbp, carbonKg))
  const n = Math.min(42, key.length, stamp.length)
  if (n >= 20 && key.slice(0, n) === stamp.slice(0, n)) return true
  if (/\b(?:below we(?:'ve| have) stamped|we(?:'ve| have) put about £|from your saved (?:row|audit))\b/i.test(text)) {
    return true
  }
  if (/\b(?:pathway numbers|not a (?:generic )?guess|not a filler estimate)\b/i.test(text)) {
    return true
  }
  return false
}

/** Drop duplicate payoff / scaffold paragraphs before packing True Tip triplets. */
export function dedupeTrueTipParagraphs(paragraphs: string[]): string[] {
  const kept: string[] = []
  for (const raw of paragraphs) {
    const p = raw.trim()
    if (!p || isBoilerplateProseParagraph(p)) continue
    const key = compactAlnumKey(p.slice(0, Math.min(180, p.length)))
    if (key.length < 12) {
      kept.push(p)
      continue
    }
    const dup = kept.some((prev) => {
      const pk = compactAlnumKey(prev.slice(0, Math.min(180, prev.length)))
      if (pk.length < 12) return false
      const n = Math.min(48, pk.length, key.length)
      return pk.slice(0, n) === key.slice(0, n) || pk.includes(key) || key.includes(pk)
    })
    if (!dup) kept.push(p)
  }
  return kept
}

/** Legacy CTA-bridge padding — replaced in Solo Focus by {@link payoffSentence}. */
export function isCtaBridgeParagraph(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/\bvia the cta\b/i.test(t)) return true
  if (/\block fabric or tariff moves\b/i.test(t)) return true
  if (/\bexecute the verified step\b/i.test(t)) return true
  if (/\bapply through the cta\b/i.test(t)) return true
  if (/\balign quotes to your postcode audit before you switch\b/i.test(t)) return true
  return false
}

function normalizeTrueTipThirdParagraph(
  journey: JourneyId,
  paragraph: string,
  moneyGbp: number,
  carbonKg: number
): string {
  const t = paragraph.trim()
  if (!t || isCtaBridgeParagraph(t) || isBoilerplateProseParagraph(t)) {
    return payoffSentence(journey, moneyGbp, carbonKg)
  }
  return t
}

export function stripBoilerplateProseSentences(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const kept = sentences.filter((s) => !isBoilerplateProseParagraph(s))
  return kept.join(' ').trim()
}

export function stripAuditorFluffParagraph(raw: string): string {
  return stripBoilerplateProseSentences(
    raw
      .replace(
        /^(?:did you know\??|consider (?:this|that)\.?\s*|fun fact:?\s*|here'?s (?:the thing|what you need to know):?\s*)/i,
        ''
      )
      .trim()
  )
}

/** Remove What/Why/How / Discovery headings Gemini may echo in `architect_prose` (expanded UI is label-free). */
export function stripArchitectEmbeddedSectionTitles(block: string): string {
  let t = stripAuditorFluffParagraph(block.trim())
  const lines = t.split('\n')
  while (lines.length > 0) {
    const L = lines[0]!.trim()
    if (
      /^(?:#{1,6}\s*|\*\*\s*)?(?:the\s+)?(?:what|why|how)(?:\s*\([^)]*\))?\s*:?\s*$/i.test(L) ||
      /^(?:#{1,6}\s*|\*\*\s*)?(?:discovery|the\s+discovery)\s*:?\s*$/i.test(L)
    ) {
      lines.shift()
      continue
    }
    break
  }
  t = lines.join('\n').trim()
  t = t
    .replace(
      /^(?:#{1,6}\s*|\*\*\s*)?(?:the\s+)?(?:what|why|how)(?:\s*\([^)]*\))?\s*:\s+/i,
      ''
    )
    .trim()
  t = t.replace(/^(?:discovery|the\s+discovery)\s*:\s+/i, '').trim()
  return stripAuditorFluffParagraph(t)
}

function compactAlnumKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function dedupeSentencesWithinParagraph(paragraph: string): string {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length <= 1) return paragraph.trim()
  const kept: string[] = []
  for (const s of sentences) {
    const key = compactAlnumKey(s.slice(0, Math.min(120, s.length)))
    if (key.length < 14) {
      kept.push(s)
      continue
    }
    const dup = kept.some((prev) => {
      const pk = compactAlnumKey(prev.slice(0, Math.min(120, prev.length)))
      if (pk.length < 14) return false
      const n = Math.min(40, pk.length, key.length)
      return pk.slice(0, n) === key.slice(0, n) || pk.includes(key) || key.includes(pk)
    })
    if (!dup) kept.push(s)
  }
  let joined = kept.join(' ')
  const placeMatch = joined.match(/\b([A-Z][a-z]+(?:'s)?)\b/g)
  if (placeMatch && placeMatch.length >= 2) {
    const first = placeMatch[0]!
    const repeats = placeMatch.filter((p) => p.toLowerCase() === first.toLowerCase()).length
    if (repeats >= 2 && joined.toLowerCase().includes(`${first.toLowerCase()}'s`)) {
      const parts = joined.split(/(?<=[.!?])\s+/)
      if (parts.length > 1) joined = parts.slice(1).join(' ').trim() || joined
    }
  }
  return joined
}

/** Drop paragraphs that repeat earlier copy (Gemini often echoes sentence 1 mid-body). */
export function collapseDuplicateProseParagraphs(text: string): string {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => dedupeSentencesWithinParagraph(p.trim()))
    .filter(Boolean)
  if (parts.length <= 1) return (parts[0] ?? text).trim()

  const kept: string[] = []
  for (const p of parts) {
    const key = compactAlnumKey(p.slice(0, Math.min(160, p.length)))
    if (key.length < 12) {
      kept.push(p)
      continue
    }
    const dup = kept.some((prev) => {
      const pk = compactAlnumKey(prev.slice(0, Math.min(160, prev.length)))
      if (pk.length < 12) return false
      const n = Math.min(48, pk.length, key.length)
      return pk.slice(0, n) === key.slice(0, n) || pk.includes(key) || key.includes(pk)
    })
    if (!dup) kept.push(p)
  }
  return kept.join('\n\n')
}

/**
 * When paragraph 1 only repeats the headline (common with architect_prose), swap in additive copy.
 */
export function dedupeTrueTipOpeningParagraph(headline: string, firstParagraph: string): string {
  const h = compactAlnumKey(stripExpandedCardTitleNoise(headline))
  const fp0 = stripAuditorFluffParagraph(firstParagraph)
  const firstSentence = fp0.split(/(?<=[.!?])\s+/)[0] ?? fp0
  const f = compactAlnumKey(firstSentence)
  const fpKey = compactAlnumKey(fp0.slice(0, Math.min(140, fp0.length)))
  if (h.length < 10 || f.length < 10) return firstParagraph
  const prefixLen = Math.min(48, h.length, f.length)
  if (prefixLen >= 10 && h.slice(0, prefixLen) === f.slice(0, prefixLen)) {
    return ''
  }
  if (h.length >= 18 && fpKey.includes(h)) {
    return ''
  }
  return firstParagraph
}

/** Solo Focus with £/kg in metrics — Marvin lead + at most one Roboto body (max-2-blocks). */
export function layoutSoloFocusProseBlocks(
  headline: string,
  triple: [string, string, string],
  opts: { journeyId: string; moneyGbp: number; carbonKg: number; omitPayoffLine?: boolean }
): { subheading: string; body: string[] } {
  const j = coerceJourneyId(opts.journeyId)
  const omitPayoff = opts.omitPayoffLine === true
  const blocks = dedupeTrueTipParagraphs(
    triple
      .map((p) => p.trim())
      .filter(
        (p) =>
          p.length > 0 &&
          !isBoilerplateProseParagraph(p) &&
          !paragraphRepeatsPayoffStamp(p, j, opts.moneyGbp, opts.carbonKg) &&
          !(omitPayoff && proseContainsMoneyStamp(p))
      )
  )
  const capped = blocks.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS)
  const subheading = capped[0] ?? ''
  const subKey = compactAlnumKey(subheading)
  const maxBody = Math.max(0, MAX_SOLO_FOCUS_PROSE_BLOCKS - (subheading ? 1 : 0))
  const body = capped.slice(1).filter((p) => {
    const k = compactAlnumKey(p)
    return k.length >= 12 && k !== subKey
  }).slice(0, maxBody)
  return { subheading, body }
}

export function polishTrueTipParagraphsForHeadline(
  headline: string,
  paras: [string, string, string]
): [string, string, string] {
  const deduped = dedupeTrueTipParagraphs(paras)
  const [a, b, c] = [deduped[0] ?? paras[0], deduped[1] ?? paras[1], deduped[2] ?? paras[2]]
  return [
    humanizeTrueTipParagraph(dedupeTrueTipOpeningParagraph(headline, a)),
    humanizeTrueTipParagraph(b),
    humanizeTrueTipParagraph(c),
  ]
}

/** Zone / bento card face — Marvin stamp (5–8 words). */
export const MIN_ZONE_CARD_HEADLINE_WORDS = 5
export const MAX_ZONE_CARD_HEADLINE_WORDS = 8
/** Solo Focus hook H1 — Marvin, ~2–3 lines (more words than bento face). */
export const MIN_EXPANDED_VIEW_HEADLINE_WORDS = 10
export const MAX_EXPANDED_VIEW_HEADLINE_WORDS = 20
/** @deprecated Use {@link MIN_ZONE_CARD_HEADLINE_WORDS} or {@link MIN_EXPANDED_VIEW_HEADLINE_WORDS}. */
export const MIN_HEADLINE_WORDS = MIN_ZONE_CARD_HEADLINE_WORDS
/** Each True Tip paragraph — readable auditor copy, not tariff tables. */
export const MAX_TRUE_TIP_PARAGRAPH_WORDS = 40

/** Expanded category label — matches collapsed Zone card top label. */
export function formatZoneCategoryLabel(journeyId: string): string {
  return String(journeyId ?? '')
    .replace(/-/g, ' ')
    .trim()
    .toUpperCase()
}

/** Profile / Solo Focus / loop — lowercase Marvin prompts (registry labels may be Title Case). */
export function formatProfileStyleQuestion(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}…`
}

/** Raw Gemini / scrape dumps — too fact-dense for expanded Solo Focus; use auditor narrative instead. */
export function isRawResearchDump(prose: string): boolean {
  const t = prose.trim()
  if (t.length < 40) return false
  const lower = t.toLowerCase()
  const tariffSignals =
    (/\d+\.?\d*\s*p\/?\s*kwh/i.test(t) || /standing charge/i.test(lower)) &&
    (/price cap|unit rate|regulatory|ofgem|distribution network/i.test(lower) ||
      /\*\*/.test(t) ||
      /^\s*\d+\.\s/m.test(t))
  const tabley = (t.match(/\d+\.\d+/g) ?? []).length >= 4 && /april 2026|bn\d{2}/i.test(t)
  const policyDump =
    /green-levy|standing-charge maths|dual-fuel around £\d/i.test(t) &&
    /price[- ]?cap|ofgem|april 2026/i.test(lower)
  return tariffSignals || tabley || policyDump
}

export function humanizeTrueTipParagraph(raw: string): string {
  const cleaned = stripMarkdownForProseDisplay(stripArchitectEmbeddedSectionTitles(raw), 900)
  return clampWords(cleaned, MAX_TRUE_TIP_PARAGRAPH_WORDS)
}

function splitHeadlineWords(title: string): string[] {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/\.{2,}|…$/g, ''))
}

/** True when a headline is agent jargon or only generic filler tokens. */
export function isLowQualityZoneHeadline(text: string): boolean {
  const words = splitHeadlineWords(text)
  if (words.length === 0) return true
  const joined = words.join(' ')
  if (isEnergyAuditDebrisHeadline(joined)) return true
  if (ZONE_HEADLINE_JARGON_RE.test(joined)) return true
  if (isZonePreviewHeadlineNoise(joined)) return true
  if (isGenericSpringHeadline(joined)) return true
  if (words.every((w) => ZONE_HEADLINE_FILLER_WORDS.has(w.toLowerCase()))) return true
  if (words.length <= 2 && /^(?:pattern|learned|zone|your)$/i.test(words[0] ?? '')) return true
  return false
}

function prepareZoneHeadlineSource(raw: string): string {
  let t = stripExpandedCardTitleNoise(raw.trim())
  const cleaned = cleanZonePreviewHeadline(t)
  if (cleaned && !isZonePreviewHeadlineNoise(cleaned)) t = cleaned
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Forensic bento headline from Neon `architect_prose` when `agent_headline` is empty or jargon.
 * Prefers the first sentence with a £ figure; otherwise the first clean sentence of paragraph 1.
 */
export function headlineFromArchitectProse(
  prose: string,
  maxWords: number = MAX_ZONE_CARD_HEADLINE_WORDS
): string | null {
  const trimmed = prose.trim()
  if (trimmed.length < 24) return null
  const firstPara =
    trimmed
      .split(/\n\s*\n/)
      .map((p) => stripProseReportLead(p))
      .find((p) => p.length >= 24) ?? stripProseReportLead(trimmed)
  const sentences = firstPara
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
  const pick =
    sentences.find((s) => /£\s*[\d,.]+[km]?/i.test(s) && !isZonePreviewHeadlineNoise(s)) ??
    sentences.find((s) => !isZonePreviewHeadlineNoise(s) && !isLowQualityZoneHeadline(s)) ??
    (firstPara.length >= 12 && !isZonePreviewHeadlineNoise(firstPara) ? firstPara : null)
  if (!pick) return null
  const resolved = zoneCardHeadlineFromRaw(pick, pick, maxWords)
  return resolved && !isLowQualityZoneHeadline(resolved) ? resolved : null
}

/**
 * Zone bento / tip face — strip jargon, never pad with "RIGHT NOW THIS MONTH", fall back when empty.
 */
/**
 * Programmatic headline contract — Zone 5–8 words; expanded Solo Focus 10–20 words (hook, 2–3 lines).
 * @param expanded — when true, uses expanded hook bounds.
 */
export function enforceHeadlineWordLimits(
  text: string,
  expanded = false,
  journeyId?: JourneyId | string
): string {
  const min = expanded ? MIN_EXPANDED_VIEW_HEADLINE_WORDS : MIN_ZONE_CARD_HEADLINE_WORDS
  const max = expanded ? MAX_EXPANDED_VIEW_HEADLINE_WORDS : MAX_ZONE_CARD_HEADLINE_WORDS
  const jid = journeyId ? coerceJourneyId(String(journeyId)) : undefined
  const journeyHook = jid ? EXPANDED_JOURNEY_HOOK[jid] : undefined
  const fallback = expanded
    ? journeyHook ?? 'save money on home bills near you'
    : 'save money on home bills near you'
  const source =
    isGenericSpringHeadline(text) && journeyHook ? journeyHook : text
  const resolved = zoneCardHeadlineFromRaw(source, fallback, max)
  const words = splitHeadlineWords(resolved)
  if (words.length < min) {
    const fb = splitHeadlineWords(zoneCardHeadlineFromRaw(fallback, fallback, max))
    return fb.length >= min ? fb.join(' ') : resolved
  }
  if (words.length > max) return `${words.slice(0, max).join(' ')}...`
  return words.join(' ')
}

export function zoneCardHeadlineFromRaw(
  raw: string,
  fallback: string,
  maxWords: number = MAX_ZONE_CARD_HEADLINE_WORDS
): string {
  const candidates = [prepareZoneHeadlineSource(raw), prepareZoneHeadlineSource(fallback), fallback.trim()]
  for (const candidate of candidates) {
    if (!candidate || isLowQualityZoneHeadline(candidate)) continue
    const words = splitHeadlineWords(candidate)
    if (words.length === 0) continue
    if (words.length <= maxWords) return words.join(' ')
    return `${words.slice(0, maxWords).join(' ')}...`
  }
  const words = splitHeadlineWords(fallback)
  if (words.length === 0) return 'SAVE MONEY LOCALLY'
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}...`
}

/** Normalize headline text for duplicate card detection on the Zone wall. */
export function normalizeCardHeadlineKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Marvin headline — strips jargon, clips at maxWords (no filler padding). */
export function headlineFromTitle(
  title: string,
  maxWords: number = MAX_ZONE_CARD_HEADLINE_WORDS,
  _minWords?: number
): string {
  const prepared = prepareZoneHeadlineSource(title)
  if (!prepared || isLowQualityZoneHeadline(prepared)) {
    const words = splitHeadlineWords(title)
    if (words.length > 0 && !isLowQualityZoneHeadline(words.join(' '))) {
      if (words.length <= maxWords) return words.join(' ')
      return `${words.slice(0, maxWords).join(' ')}...`
    }
    return ''
  }
  const words = splitHeadlineWords(prepared)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}...`
}

/** Expanded Solo Focus hook when DB title is thin or off-topic. */
const EXPANDED_JOURNEY_HOOK: Partial<Record<JourneyId, string>> = {
  travel: 'ONE RAIL OR BUS COMMUTE A WEEK STILL CUTS FUEL AND FARE WASTE',
  holidays: 'SHORT HAUL BY TRAIN BEATS A FLIGHT FOR COST AND CARBON',
  home: 'SEAL DRAUGHTS AND LOFT GAPS BEFORE YOU CHASE A NEW BOILER',
  utilities: 'LINE UP YOUR TARIFF WITH THE APRIL CAP BEFORE YOU LOCK IN',
  grants: 'CHECK BUS HEAT PUMP GRANT RULES BEFORE YOU BOOK AN INSTALLER',
  solar: 'SIZE SOLAR TO YOUR ROOF AND DAYTIME USE NOT A GENERIC KIT',
  food: 'PLAN MEALS AROUND WHAT YOU ALREADY HAVE TO CUT FOOD WASTE',
  shopping: 'REPAIR AND REUSE BEFORE YOU REPLACE ANOTHER HOME ITEM',
  money: 'MOVE IDLE CASH TO A CLEANER ACCOUNT WITHOUT LOSING ACCESS',
  tech: 'CUT STANDBY DRAW ON PLUGS YOU LEAVE ON ALL NIGHT',
  water: 'FIT AERATORS AND FIX DRIPS BEFORE THE METER TICKS UP',
  waste: 'SORT AND COMPOST AT HOME TO EASE COUNCIL BIN PRESSURE',
  carbon: 'TRACK ONE BIG ENERGY HABIT AND TRIM WHAT YOU DO NOT NEED',
}

/** Expanded Solo Focus H1 — hook headline with 2–3 line word budget. */
export function headlineFromExpandedHook(
  title: string,
  journeyId?: string
): string {
  const jid = journeyId ? coerceJourneyId(journeyId) : undefined
  const journeyHook = jid ? EXPANDED_JOURNEY_HOOK[jid] : undefined
  const prepared = prepareZoneHeadlineSource(title)
  const resolved = enforceHeadlineWordLimits(prepared || title, true)
  const words = splitHeadlineWords(resolved)
  const weak =
    isLowQualityZoneHeadline(resolved) ||
    isGenericSpringHeadline(resolved) ||
    words.length < MIN_EXPANDED_VIEW_HEADLINE_WORDS ||
    (jid != null && headlineConflictsWithJourney(jid, resolved))
  if (jid && journeyHook && (weak || isGenericSpringHeadline(prepared || title))) {
    return enforceHeadlineWordLimits(journeyHook, true, jid)
  }
  if (words.length < MIN_EXPANDED_VIEW_HEADLINE_WORDS && journeyHook) {
    return enforceHeadlineWordLimits(journeyHook, true, jid)
  }
  return resolved
}

/** Clean domain for Source link (e.g. gov.uk, ofgem.gov.uk). */
export function formatSourceDomainLabel(url: string): string {
  const u = url.trim()
  if (!u.startsWith('http')) return u.slice(0, 48)
  try {
    return new URL(u).hostname.replace(/^www\./i, '')
  } catch {
    return u.slice(0, 48)
  }
}

/** Short display string for verified source URLs (expanded Solo Focus footer link). */
export function formatAuditSourceLinkDisplay(url: string, maxLen = 96): string {
  const domain = formatSourceDomainLabel(url)
  return domain.length > maxLen ? `${domain.slice(0, Math.max(0, maxLen - 1))}…` : domain
}

/** CTA uses offer_url; Source link uses source_url; CTA falls back to Ask Zai when no offer. */
export function resolveSoloFocusHandoffUrls(args: {
  journeyKey: string
  coverageOfferUrl?: string | null
  coverageSourceUrl?: string | null
  fallbackOfferUrl?: string | null
  fallbackSourceUrl?: string | null
  buildZaiUrl: () => string
}): { ctaUrl: string; offerUrl: string; sourceLinkUrl: string; ctaIsZai: boolean } {
  const j = coerceJourneyId(args.journeyKey)
  const pick = (u?: string | null) =>
    typeof u === 'string' && u.trim().startsWith('http') ? sanitizeZoneOfferUrl(u, j) : ''
  const offerUrl = pick(args.coverageOfferUrl) || pick(args.fallbackOfferUrl)
  const sourceUrl = pick(args.coverageSourceUrl) || pick(args.fallbackSourceUrl)
  const ctaIsZai = !offerUrl
  const ctaUrl = offerUrl || args.buildZaiUrl()
  return { ctaUrl, offerUrl, sourceLinkUrl: sourceUrl, ctaIsZai }
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
const COMPUTING_PLACEHOLDER_RE = /^computing[\s.…]*$/i

export function composeScrapedInsightDescription(
  parts: Array<string | null | undefined>,
  maxSentences = 3
): string {
  const raw = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0 && !COMPUTING_PLACEHOLDER_RE.test(p))
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
  const j = coerceJourneyId(args.journeyId)
  const toParagraphs = (text: string): string[] => {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (sentences.length >= 3) return sentences.slice(0, 3)
    if (sentences.length === 2) {
      return [
        sentences[0]!,
        sentences[1]!,
        payoffSentence(j, args.moneyGbp, args.carbonKg),
      ]
    }
    if (sentences.length === 1) {
      const src = (args.sourceDisplayName ?? '').trim() || 'UK Government'
      const pc = (args.userPostcode ?? '').trim() || 'your postcode'
      return buildAuditorNarrativeParagraphs({
        userPostcode: pc,
        sourceName: src,
        journey: j,
        moneyGbp: args.moneyGbp,
        carbonKg: args.carbonKg,
        locality: args.auditHeaderLocality ?? '',
      })
    }
    return []
  }
  if (scraped && !GENERIC_SCRAPED.test(scraped)) {
    const joined = toParagraphs(scraped).join('\n\n')
    return pruneDuplicateLocalityInsight(joined, args.headline, args.auditHeaderLocality, args.journeyId)
  }
  const pc = (args.userPostcode ?? '').trim() || 'your postcode'
  const src = (args.sourceDisplayName ?? '').trim() || 'UK Government'
  const fallback = buildAuditorNarrativeParagraphs({
    userPostcode: pc,
    sourceName: src,
    journey: j,
    moneyGbp: args.moneyGbp,
    carbonKg: args.carbonKg,
    locality: args.auditHeaderLocality ?? '',
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

/**
 * Three paragraphs from Neon `research_results.architect_prose` + verified £/CO₂e figures.
 * Prefer `\n\n`-split blocks when the DB row already carries three-paragraph shape.
 */
export function buildResearchResultsTrueTipBody(params: {
  architectProse: string
  verifiedSavingGbp: number
  carbonKg: number
  journeyId: string
}): string {
  const j = coerceJourneyId(params.journeyId)
  const sanitized =
    sanitizeArchitectProseForJourney(j, params.architectProse.trim()) ?? ''
  if (!sanitized) {
    return buildAuditorNarrativeParagraphs({
      userPostcode: 'your postcode',
      sourceName: 'UK Government',
      journey: j,
      moneyGbp: params.verifiedSavingGbp,
      carbonKg: params.carbonKg,
      locality: '',
    }).join('\n\n')
  }
  const rawClean = stripMarkdownForProseDisplay(
    stripProseReportLead(stripArchitectEmbeddedSectionTitles(sanitized)),
    4000
  )
  const m = Math.max(0, Math.round(params.verifiedSavingGbp))
  const c = Math.max(0, Math.round(params.carbonKg))
  const omitPayoff = proseContainsMoneyStamp(rawClean)
  const blocks = rawClean
    .split(/\n\s*\n/)
    .map((p) =>
      humanizeTrueTipParagraph(
        stripAuditorFluffParagraph(stripArchitectEmbeddedSectionTitles(p.trim()))
      )
    )
    .filter(
      (p) =>
        p.length > 0 &&
        !isBoilerplateProseParagraph(p) &&
        !paragraphRepeatsPayoffStamp(p, j, m, c)
    )
  const filtered = dedupeTrueTipParagraphs(blocks)
  if (filtered.length >= 3) {
    const third = omitPayoff
      ? filtered[2]!
      : normalizeTrueTipThirdParagraph(j, filtered[2]!, m, c)
    const packed = dedupeTrueTipParagraphs(
      omitPayoff ? filtered.slice(0, 3) : [filtered[0]!, filtered[1]!, third]
    )
    return collapseDuplicateProseParagraphs(packed.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS).join('\n\n'))
  }
  if (filtered.length === 2) {
    if (omitPayoff) {
      return collapseDuplicateProseParagraphs(filtered.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS).join('\n\n'))
    }
    const packed = dedupeTrueTipParagraphs([filtered[0]!, filtered[1]!, payoffSentence(j, m, c)])
    return packed.join('\n\n')
  }
  /** Legacy single blob without blank-line breaks: split sentences into three beats. */
  const sentences = rawClean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length >= 3) {
    const n = sentences.length
    const a = Math.max(1, Math.ceil(n / 3))
    const b = Math.max(a + 1, Math.ceil((2 * n) / 3))
    return [sentences.slice(0, a).join(' '), sentences.slice(a, b).join(' '), sentences.slice(b).join(' ')].join(
      '\n\n'
    )
  }
  const what = filtered[0] ?? blocks[0] ?? rawClean
  if (omitPayoff) {
    const packed = dedupeTrueTipParagraphs([what, filtered[1] ?? ''].filter(Boolean))
    return collapseDuplicateProseParagraphs(packed.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS).join('\n\n'))
  }
  const packed = dedupeTrueTipParagraphs([
    what,
    filtered[1] ?? '',
    payoffSentence(j, m, c),
  ]).filter(Boolean)
  while (packed.length < 3) {
    packed.push(payoffSentence(j, m, c))
  }
  return collapseDuplicateProseParagraphs(packed.slice(0, 3).join('\n\n'))
}

/** Unified resolver: DB-backed True Tip when audit category matches, else scraped + auditor fallback. */
export function resolveExpandedTrueTipInsight(args: {
  architectProse?: string | null
  verifiedAuditMatchesJourney: boolean
  morphParts: Array<string | null | undefined>
  journeyId: string
  headline: string
  moneyGbp: number
  carbonKg: number
  transportBaseline?: string | null
  travelFuelType?: string | null
  userPostcode?: string | null
  sourceDisplayName?: string | null
  auditHeaderLocality?: string | null
}): string {
  const ap = (args.architectProse ?? '').trim()
  const jid = coerceJourneyId(args.journeyId)
  const sanitizedAp = ap ? sanitizeArchitectProseForJourney(jid, ap) : null
  if (
    args.verifiedAuditMatchesJourney &&
    sanitizedAp &&
    sanitizedAp.length > 0 &&
    !isRawResearchDump(sanitizedAp)
  ) {
    return buildResearchResultsTrueTipBody({
      architectProse: sanitizedAp,
      verifiedSavingGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      journeyId: args.journeyId,
    })
  }
  return resolveSoloFocusInsightDisplay({
    morphParts: args.morphParts,
    journeyId: args.journeyId,
    headline: args.headline,
    moneyGbp: args.moneyGbp,
    carbonKg: args.carbonKg,
    transportBaseline: args.transportBaseline,
    travelFuelType: args.travelFuelType,
    userPostcode: args.userPostcode,
    sourceDisplayName: args.sourceDisplayName,
    auditHeaderLocality: args.auditHeaderLocality,
  })
}

/**
 * Normalise any insight string into exactly three paragraphs for the True Tip layout.
 * Prefers existing `\n\n` blocks; otherwise groups sentences.
 */
export function toThreeTrueTipParagraphs(
  text: string,
  options?: {
    journeyId?: string
    moneyGbp?: number
    carbonKg?: number
    userPostcode?: string | null
    sourceDisplayName?: string | null
    auditHeaderLocality?: string | null
    /** When false, omit £/kg payoff paragraph (metrics row carries savings). */
    includePayoffParagraph?: boolean
  }
): [string, string, string] {
  const j = coerceJourneyId(options?.journeyId ?? 'home')
  const money = options?.moneyGbp ?? 0
  const carbon = options?.carbonKg ?? 0
  const omitFromProse = proseContainsMoneyStamp(text)
  const includePayoff =
    options?.includePayoffParagraph !== false && !omitFromProse
  const pack3 = (a: string, b: string, c: string): [string, string, string] => {
    const third = includePayoff
      ? normalizeTrueTipThirdParagraph(j, c, money, carbon)
      : stripAuditorFluffParagraph(c)
    const payoff = payoffSentence(j, money, carbon)
    let parts = dedupeTrueTipParagraphs([
      stripAuditorFluffParagraph(a),
      stripAuditorFluffParagraph(b),
      ...(third.trim() ? [third] : []),
    ]).filter((p) => p.trim().length > 0 && !isBoilerplateProseParagraph(p))
    parts = parts.filter((p) => !paragraphRepeatsPayoffStamp(p, j, money, carbon))
    const src = (options?.sourceDisplayName ?? '').trim() || 'UK Government'
    const pc = (options?.userPostcode ?? '').trim() || 'your postcode'
    const narrative = buildAuditorNarrativeParagraphs({
      userPostcode: pc,
      sourceName: src,
      journey: j,
      moneyGbp: money,
      carbonKg: carbon,
      locality: options?.auditHeaderLocality ?? '',
    })
    const targetLen = includePayoff ? 3 : 2
    while (parts.length < targetLen) {
      const pad = narrative[parts.length] ?? narrative[0]!
      if (pad && !parts.includes(pad) && !paragraphRepeatsPayoffStamp(pad, j, money, carbon)) {
        parts.push(pad)
      } else break
    }
    if (includePayoff) {
      parts.push(payoff)
      parts = dedupeTrueTipParagraphs(parts).slice(0, 3)
      while (parts.length < 3) {
        parts.push(payoff)
      }
    } else {
      parts = dedupeTrueTipParagraphs(parts).slice(0, 2)
    }
    const out = parts.map((p) => humanizeTrueTipParagraph(p))
    while (out.length < 3) out.push('')
    return [out[0] ?? '', out[1] ?? '', out[2] ?? '']
  }

  const padMechanicalThird = (a: string, b: string): [string, string, string] =>
    pack3(a, b, payoffSentence(j, money, carbon))

  const padFromSingle = (only: string): [string, string, string] => {
    const src = (options?.sourceDisplayName ?? '').trim() || 'UK Government'
    const pc = (options?.userPostcode ?? '').trim() || 'your postcode'
    const paras = buildAuditorNarrativeParagraphs({
      userPostcode: pc,
      sourceName: src,
      journey: j,
      moneyGbp: options?.moneyGbp ?? 0,
      carbonKg: options?.carbonKg ?? 0,
      locality: options?.auditHeaderLocality ?? '',
    })
    return pack3(only, paras[1] ?? paras[0]!, paras[2] ?? payoffSentence(j, money, carbon))
  }

  const t = collapseDuplicateProseParagraphs(stripProseReportLead(text.trim()))
  if (!t) {
    return ['', '', '']
  }
  const parts = t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 3) {
    return pack3(parts[0]!, parts[1]!, parts[2]!)
  }
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length >= 3) {
    const n = sentences.length
    const a = Math.max(1, Math.ceil(n / 3))
    const b = Math.max(a + 1, Math.ceil((2 * n) / 3))
    return pack3(
      sentences.slice(0, a).join(' '),
      sentences.slice(a, b).join(' '),
      sentences.slice(b).join(' ')
    )
  }
  if (sentences.length === 2) {
    return padMechanicalThird(sentences[0]!, sentences[1]!)
  }
  if (sentences.length === 1) {
    return padFromSingle(sentences[0]!)
  }
  return pack3(t, t, t)
}
