/**
 * Solo Focus v1.8.3 — shared headline + insight/RESULT asterisk logic (one template, dual entry).
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { sanitizeAgentMarkdown, stripMarkdownForProseDisplay } from '@/lib/agents/zeroHunterMarkdown'
import {
  buildAuditorDetectionParagraph,
  buildAuditorNarrativeParagraphs,
  isGenericAuditorProofParagraph,
  payoffSentence,
  proofSentenceVariant,
} from '@/lib/zone/auditorNarrative'
import { personalizeTrueTipPlaceLead, resolveSoloFocusPlaceLabel } from '@/lib/zone/localityCopy'
import { sanitizeArchitectProseForJourney, isCoherentParagraph } from '@/lib/zone/contentProseSanitize'
import { isTruncatedSentence, stripTrailingEllipsis, clampWordsCompleteSentence } from '@/lib/zone/proseComplete'
import { humanizeZoneHeadline, humanizeZoneProse } from '@/lib/zone/plainEnglishCopy'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { inferZaiCtaLabel } from '@/lib/zai/resolveZaiLikeHandoff'
import { inferRevenueCtaKind, resolveRevenueCtaLabel } from '@/lib/zone/verifiedRevenue'
import { applySessionProseVariety } from '@/lib/zone/sessionProseLedger'
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
  return stripTrailingEllipsis(t)
}

/** Solo Focus lead — complete sentences only; no ellipsis mid-thought. */
function finalizeSoloFocusLead(lead: string, fallback: string): string {
  const cleaned = stripTrailingEllipsis(lead.trim())
  const use = cleaned && !isTruncatedSentence(cleaned) ? cleaned : fallback
  const capped = clampWordsCompleteSentence(stripTrailingEllipsis(use.trim()), MAX_SOLO_FOCUS_LEAD_WORDS)
  if (!isTruncatedSentence(capped)) return capped
  const fb = clampWordsCompleteSentence(stripTrailingEllipsis(fallback.trim()), MAX_SOLO_FOCUS_LEAD_WORDS)
  return isTruncatedSentence(fb) ? fb.replace(/\s*[—–-]\s*[^.!?]+$/, '.').trim() : fb
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
  if (headlineEndsIncomplete(prepared)) return false
  return true
}

/** True when a headline is still report metadata, not a user-facing insight. */
export function isZonePreviewHeadlineNoise(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 3) return true
  /* 8–10 word hooks are ~55–85 chars — do not treat as noise (was 52 → mid-word clips). */
  if (t.length > 160) return true
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
  t = stripTrailingEllipsis(t)
  if (isTruncatedSentence(t)) return ''
  if (isEnergyAuditDebrisHeadline(t)) return ''
  if (isZonePreviewHeadlineNoise(t)) {
    const action = t.match(
      /\b(loft|solar|tariff|radiator|boiler|grant|insulation|commute|kwh|seal|foil|switch|upgrade|ev|heat pump)[^.!?]{12,120}/i
    )
    if (action?.[0] && !isZonePreviewHeadlineNoise(action[0])) {
      t = trimHeadlineToMaxWords(action[0].trim(), MAX_ZONE_CARD_HEADLINE_WORDS)
    } else {
      return ''
    }
  }
  /* Word limits applied later via clampZoneBentoHeadline — never hard-slice characters (mid-word clips). */
  return humanizeZoneHeadline(t)
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
  /\b(?:open the verified source(?:\s+link)?\s+below to complete this action(?:\s+and lock in the saving)?|open the verified source to complete this action|use the link below to execute the verified offer|use the primary action below to claim|use the verified source to execute the action plan|verify the offer before you|publishes guidance on this habit)\b/i

const GENERIC_SPRING_HEADLINE_RE =
  /\bone\s+clear\s+move\s+near\s+you\b.*\b(?:bill\s+savings|locks\s+real)\b/i

/** Legacy agent scaffolding — strip before Solo Focus display. */
const MECHANICAL_SCAFFOLD_PROSE_RE =
  /\b(?:execute the audited step|execute the verified step|we treat the ~£|optimization plan|green funding frameworks|at today'?s pathway numbers|fresh audit:|live partner offer unavailable|footprint liabilities|hedges capital liabilities)\b/i

const THIN_FLUFF_PROSE_RE =
  /^your\s+\w+\s+is\s+high[- ]?value\.?$/i

/** Brains tile fallback — not a locality audit lead for Solo Focus. */
const GENERIC_CALCULATION_INSIGHT_RE =
  /\b(?:your home is running efficiently|above the efficient regional baseline|optimise tariff and controls first)\b/i

/** Static recommendation / tile copy — no postcode audit opener. */
const GENERIC_RECOMMENDATION_LEAD_RE =
  /\b(?:if you stay on gas|electric homes save most|smart tariff \+ insulation|still move the needle|energy saving trust has \d{4} guides|off-peak or smart tariff pricing)\b/i

export function isGenericCalculationInsight(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return GENERIC_CALCULATION_INSIGHT_RE.test(t)
}

/** Brains / morph one-liners and tariff filler without an `In [place]` audit lead. */
export function isGenericNonLocalityLead(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (isGenericCalculationInsight(t)) return true
  if (GENERIC_RECOMMENDATION_LEAD_RE.test(t)) return true
  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when paragraph 1 already carries the Marvin locality audit opener. */
export function hasLocalityAuditorLeadShape(text: string, placeLabel: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/\bquietly slip away on\b/i.test(t)) return true
  if (/\bcould (?:be leaving|miss(?:\s+about)?)\b/i.test(t) && /\b£[\d,]+/i.test(t)) return true
  if (/\bin\s+(?:your area|[A-Z])/i.test(t) && /\babout £[\d,]+(?:\.\d+)? a year can\b/i.test(t)) {
    return true
  }
  if (placeLabel !== 'your area') {
    const esc = escapeRegExp(placeLabel)
    if (new RegExp(`\\bIn\\s+${esc}\\b`, 'i').test(t) && /\b£\d/.test(t)) return true
  }
  return false
}

function ensureLocalityAuditorLead(
  triple: [string, string, string],
  params: {
    journeyId: string
    moneyGbp: number
    carbonKg: number
    locality?: string | null
    postcode?: string | null
    userPostcode?: string | null
    sourceDisplayName?: string | null
  }
): [string, string, string] {
  const placeLabel = resolveSoloFocusPlaceLabel({
    locality: params.locality,
    postcode: params.postcode,
  })
  const j = coerceJourneyId(params.journeyId)
  const [a, , c] = triple
  const lead = a.trim()
  if (hasLocalityAuditorLeadShape(lead, placeLabel)) {
    return triple
  }

  const detection = buildAuditorDetectionParagraph({
    placeLabel,
    moneyGbp: params.moneyGbp,
    journey: j,
  })

  let demoted = ''
  if (lead && !isGenericNonLocalityLead(lead) && !isBoilerplateProseParagraph(lead)) {
    demoted = lead
  }

  let b = triple[1] ?? ''
  if (!b.trim()) {
    if (demoted) {
      b = demoted
    } else {
      const src = (params.sourceDisplayName ?? '').trim() || 'UK Government'
      const pc = (params.userPostcode ?? '').trim() || ''
      const paras = buildAuditorNarrativeParagraphs({
        userPostcode: pc,
        sourceName: src,
        journey: j,
        moneyGbp: params.moneyGbp,
        carbonKg: params.carbonKg,
        locality: params.locality ?? '',
      })
      b = paras[1] ?? ''
    }
  }

  return [detection, b, c]
}

/** Marketing / AI bridge — never a Solo Focus body block. */
const BRIDGE_PHRASE_PROSE_RE =
  /\b(?:here(?:'s| is) how you can|in conclusion|to summarize|unlock your potential|you could save|as an ai|i can help|absolutely!?|great news)\b/i

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
    BRIDGE_PHRASE_PROSE_RE.test(t) ||
    isCtaBridgeParagraph(t) ||
    isMechanicalScaffoldParagraph(t) ||
    isGenericAuditorProofParagraph(t) ||
    isGenericCalculationInsight(t) ||
    isGenericNonLocalityLead(t)
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

/** Solo Focus with £/kg in metrics — Marvin lead (H4) + at most one Roboto body. */
export function layoutSoloFocusProseBlocks(
  headline: string,
  triple: [string, string, string],
  opts: {
    journeyId: string
    moneyGbp: number
    carbonKg: number
    omitPayoffLine?: boolean
    placeLabel?: string
  }
): { subheading: string; body: string | null } {
  const j = coerceJourneyId(opts.journeyId)
  const omitPayoff = opts.omitPayoffLine === true
  const placeLabel = opts.placeLabel ?? 'your area'
  const blocks = dedupeTrueTipParagraphs(
    triple
      .map((p) => p.trim())
      .filter(
        (p) =>
          p.length > 0 &&
          !isBoilerplateProseParagraph(p) &&
          !paragraphRepeatsPayoffStamp(p, j, opts.moneyGbp, opts.carbonKg) &&
          !(
            omitPayoff &&
            proseContainsMoneyStamp(p) &&
            !hasLocalityAuditorLeadShape(p, placeLabel)
          )
      )
  )
  const capped = blocks.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS)
  let subheading = capped[0] ?? ''
  subheading = dedupeTrueTipOpeningParagraph(headline, subheading) || subheading
  subheading = subheading.trim()
  const subKey = compactAlnumKey(subheading)
  let body: string | null = null

  const second = capped[1]?.trim()
  if (second && !isBoilerplateProseParagraph(second)) {
    const leadWords = splitHeadlineWords(subheading).length
    const mergedRaw = `${subheading} ${second}`.replace(/\s+/g, ' ').trim()
    const mergedWords = splitHeadlineWords(mergedRaw).length
    if (leadWords < MAX_SOLO_FOCUS_LEAD_WORDS && mergedWords <= MAX_SOLO_FOCUS_LEAD_WORDS) {
      subheading = mergedRaw
      for (let i = 2; i < capped.length; i++) {
        const candidate = capped[i]!.trim()
        if (!candidate) continue
        const k = compactAlnumKey(candidate)
        if (k.length < 12 || k === subKey) continue
        body = candidate
        break
      }
      return {
        subheading: clampWords(subheading, MAX_SOLO_FOCUS_LEAD_WORDS),
        body: body ? clampWords(body, MAX_TRUE_TIP_PARAGRAPH_WORDS) : null,
      }
    }
  }

  for (let i = 1; i < capped.length; i++) {
    const candidate = capped[i]!.trim()
    if (!candidate) continue
    const k = compactAlnumKey(candidate)
    if (k.length < 12 || k === subKey) continue
    body = candidate
    break
  }
  return {
    subheading: clampWords(subheading.trim(), MAX_SOLO_FOCUS_LEAD_WORDS),
    body: body ? clampWords(body.trim(), MAX_TRUE_TIP_PARAGRAPH_WORDS) : null,
  }
}

/** Strict display contract: Marvin audit lead only — £/CO₂e live in the metrics row. */
function proseTopicsConflict(headline: string, prose: string): boolean {
  const h = headline.toLowerCase()
  const p = prose.toLowerCase()
  if (/\be-?bike|ebike|salary.?sacrifice|cycle to work\b/i.test(h)) {
    return /\b(?:flight|short-haul|rail instead of air|domestic flights|trip budget|booking one trip by rail)\b/i.test(p)
  }
  if (/\brailcard|annual rail\b/i.test(h)) {
    return /\be-?bike|ebike|cycle to work|salary.?sacrifice\b/i.test(p)
  }
  if (/\b(?:motorway|cruise|60mph|tyre pressure)\b/i.test(h)) {
    return /\b(?:flight|railcard|e-?bike|ebike)\b/i.test(p)
  }
  return false
}

function polishRockHabitInsight(insight: string, journeyId: JourneyId): string {
  const raw = humanizeZoneProse(insight.trim(), journeyId)
  return humanizeTrueTipParagraph(stripAuditorFluffParagraph(raw), journeyId)
}

/** Habit-specific proof — never journey detection banks (flights on e-bike, etc.). */
function friendlyRockSourceName(sourceName: string): string {
  const t = sourceName.trim()
  if (!t) return 'UK guidance'
  if (/^est$/i.test(t)) return 'Energy Saving Trust'
  return t
}

export function rockHabitProofSentence(
  title: string,
  insight: string,
  sourceName: string,
  journeyId?: JourneyId | string
): string {
  const source = friendlyRockSourceName(sourceName)
  const topic = `${title} ${insight}`.toLowerCase()
  if (/\bdraught|draft|loft|hatch|foam|seal|gap|insulation\b/i.test(topic)) {
    return `${source} ranks fabric fixes ahead of boiler swaps — a strip round the loft hatch keeps warm air downstairs.`
  }
  if (/\bboiler|radiator|thermostat|heating\b/i.test(topic)) {
    return `${source} says seal the shell before you price a new boiler — wasted heat is still the quieter bill leak.`
  }
  if (/\be-?bike|ebike|cycle to work|salary.?sacrifice\b/i.test(topic)) {
    return `${source} runs cycle-to-work rules — salary-sacrifice e-bikes often beat a second car for local miles.`
  }
  if (/\brailcard|leisure train|weekend.*train\b/i.test(topic)) {
    return `${source} prices off-peak leisure trains below last-minute fuel — a railcard compounds the saving.`
  }
  if (/\bcruise|motorway|steady throttle\b/i.test(topic)) {
    return `${source} backs steady motorway throttle — constant speed beats stop-start on long runs.`
  }
  if (/\btyre pressure|under-inflat\b/i.test(topic)) {
    return `${source} ties under-inflated tyres to drag — a monthly check is cheap audit labour.`
  }
  if (/\bshower|aerator|drip\b/i.test(topic)) {
    return `${source} links drips and long showers to meter step-changes — aerators land before you argue the standing charge.`
  }
  if (/\bstandby|phantom|plug\b/i.test(topic)) {
    return `${source} clocks standby draw on routers and chargers — one weekend plug audit beats guessing from the bill.`
  }
  const j = coerceJourneyId(journeyId ?? 'home')
  const seed = compactAlnumKey(topic).length % 3
  return proofSentenceVariant(j, source, undefined, seed)
}

/** Rock saving tips — insight-led prose; never holidays/travel detection fallbacks. */
export function resolveRockHabitDisplayProse(args: {
  title: string
  insight: string
  headline?: string
  journeyId: string
  moneyGbp: number
  carbonKg: number
  sourceDisplayName?: string | null
}): { lead: string; body: string | null } {
  const j = coerceJourneyId(args.journeyId)
  const insight = polishRockHabitInsight(args.insight, j)
  if (!insight) return { lead: '', body: null }
  const proof = rockHabitProofSentence(
    args.title,
    args.insight,
    args.sourceDisplayName ?? 'UK guidance',
    j
  )
  const headline = (args.headline ?? '').trim()
  const residualInsight = headline
    ? dedupeTrueTipOpeningParagraph(headline, insight) || ''
    : insight
  const parts: string[] = []
  if (residualInsight) parts.push(residualInsight)
  if (proof) {
    const proofResidual = headline ? dedupeTrueTipOpeningParagraph(headline, proof) || proof : proof
    if (
      proofResidual &&
      !isBoilerplateProseParagraph(proofResidual) &&
      !parts.some((p) => compactAlnumKey(p).includes(compactAlnumKey(proofResidual).slice(0, 20)))
    ) {
      parts.push(proofResidual)
    }
  }
  let lead = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (!lead) lead = isBoilerplateProseParagraph(proof) ? '' : proof
  const money = Math.max(0, Math.round(args.moneyGbp))
  if (money > 0 && lead && !proseContainsMoneyStamp(lead)) {
    lead = `${lead} About £${formatMoneyValue(money)} a year sits on this row from your audit.`
  }
  return {
    lead: lead ? clampWordsCompleteSentence(lead, MAX_SOLO_FOCUS_LEAD_WORDS) : '',
    body: null,
  }
}

export function resolveSoloFocusDisplayProse(args: {
  headline: string
  insightSource: string
  journeyId: string
  moneyGbp: number
  carbonKg: number
  userPostcode?: string | null
  sourceDisplayName?: string | null
  auditHeaderLocality?: string | null
  locality?: string | null
  postcode?: string | null
  /** Rock rail tips — habit copy only; no journey detection banks. */
  contentMode?: 'rock' | 'journey'
  habitTitle?: string
}): { lead: string; body: string | null } {
  if (args.contentMode === 'rock') {
    return resolveRockHabitDisplayProse({
      title: (args.habitTitle ?? args.headline).trim(),
      insight: args.insightSource,
      headline: args.headline,
      journeyId: args.journeyId,
      moneyGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      sourceDisplayName: args.sourceDisplayName,
    })
  }

  const omitPayoffLine = shouldOmitPayoffLine(args.insightSource)
  const placeLabel = resolveSoloFocusPlaceLabel({
    locality: args.locality,
    postcode: args.postcode,
  })
  const triple = polishTrueTipParagraphsForHeadline(
    args.headline,
    toThreeTrueTipParagraphs(args.insightSource, {
      journeyId: args.journeyId,
      moneyGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      userPostcode: args.userPostcode,
      sourceDisplayName: args.sourceDisplayName,
      auditHeaderLocality: args.auditHeaderLocality,
      includePayoffParagraph: false,
    })
  )
  const personalized = personalizeTrueTipPlaceLead(triple, {
    locality: args.locality ?? undefined,
    postcode: args.postcode ?? undefined,
  }) as [string, string, string]
  const withLocalityLead = ensureLocalityAuditorLead(personalized, {
    journeyId: args.journeyId,
    moneyGbp: args.moneyGbp,
    carbonKg: args.carbonKg,
    locality: args.locality,
    postcode: args.postcode,
    userPostcode: args.userPostcode,
    sourceDisplayName: args.sourceDisplayName,
  })
  const { subheading } = layoutSoloFocusProseBlocks(args.headline, withLocalityLead, {
    journeyId: args.journeyId,
    moneyGbp: args.moneyGbp,
    carbonKg: args.carbonKg,
    omitPayoffLine,
    placeLabel,
  })

  if (hasLocalityAuditorLeadShape(subheading, placeLabel)) {
    if (!proseTopicsConflict(args.headline, subheading)) {
      return {
        lead: finalizeSoloFocusLead(
          subheading,
          buildAuditorDetectionParagraph({
            placeLabel,
            moneyGbp: args.moneyGbp,
            journey: coerceJourneyId(args.journeyId),
          })
        ),
        body: null,
      }
    }
  }

  const polishedInsight = polishRockHabitInsight(args.insightSource, coerceJourneyId(args.journeyId))
  if (polishedInsight && !proseTopicsConflict(args.headline, polishedInsight)) {
    return {
      lead: finalizeSoloFocusLead(
        polishedInsight,
        buildAuditorDetectionParagraph({
          placeLabel,
          moneyGbp: args.moneyGbp,
          journey: coerceJourneyId(args.journeyId),
        })
      ),
      body: null,
    }
  }

  const detection = buildAuditorDetectionParagraph({
    placeLabel,
    moneyGbp: args.moneyGbp,
    journey: coerceJourneyId(args.journeyId),
  })
  if (proseTopicsConflict(args.headline, detection) && polishedInsight) {
    return {
      lead: finalizeSoloFocusLead(
        polishedInsight,
        detection
      ),
      body: null,
    }
  }
  return { lead: finalizeSoloFocusLead(detection, detection), body: null }
}

/** Content-architect imperative — not a third prose block when audit copy is complete. */
export function shouldShowSoloFocusArchitectActionLine(
  actionLine: string | null | undefined,
  insightSource: string
): boolean {
  const line = (actionLine ?? '').trim()
  if (!line || isBoilerplateProseParagraph(line)) return false
  if (shouldOmitPayoffLine(insightSource)) return false
  if (proseContainsMoneyStamp(insightSource)) return false
  return false
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

/** Zone / bento card face — Marvin stamp (8–10 words). Today's Tips (Rock catalog) use this. */
export const MIN_ZONE_CARD_HEADLINE_WORDS = 8
export const MAX_ZONE_CARD_HEADLINE_WORDS = 10
/** Journey mother-card face (GRANTS/SOLAR/etc.) — same stamp style, more room for locality + a figure. */
export const MIN_JOURNEY_CARD_HEADLINE_WORDS = 9
export const MAX_JOURNEY_CARD_HEADLINE_WORDS = 12
/** Solo Focus hook H1 — Marvin, ~3–4 lines (20–24 words). */
export const MIN_EXPANDED_VIEW_HEADLINE_WORDS = 20
export const MAX_EXPANDED_VIEW_HEADLINE_WORDS = 24
/** Solo Focus Marvin lead (H4 subheading) — richer locality audit line. */
export const MAX_SOLO_FOCUS_LEAD_WORDS = 30
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

/** Solo Focus top rail — category alone, or "Travel - RAC" when a handoff provider is known. */
export function formatSoloFocusTopCategoryLabel(
  zoneCategoryLabel: string,
  offerProviderName?: string | null
): string {
  const providerRaw = offerProviderName?.trim()
  if (!providerRaw) return zoneCategoryLabel
  const provider = /^est$/i.test(providerRaw) ? 'Energy Saving Trust' : providerRaw
  const categoryTitle = zoneCategoryLabel
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  return `${categoryTitle} - ${provider}`
}

/** Profile / Solo Focus / loop — lowercase Marvin prompts (registry labels may be Title Case). */
export function formatProfileStyleQuestion(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function clampWords(text: string, maxWords: number): string {
  return clampWordsCompleteSentence(text, maxWords)
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

export function humanizeTrueTipParagraph(raw: string, journeyId?: JourneyId | string): string {
  const cleaned = stripMarkdownForProseDisplay(stripArchitectEmbeddedSectionTitles(raw), 900)
  const plain = humanizeZoneProse(cleaned, journeyId)
  return clampWords(plain, MAX_TRUE_TIP_PARAGRAPH_WORDS)
}

function splitHeadlineWords(title: string): string[] {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.!?]+$/g, '').replace(/\.{2,}|…$/g, ''))
    .filter(Boolean)
}

/** Strip terminal punctuation before word limits (period re-applied at display). */
function stripHeadlineTerminalPunctuation(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/g, '')
    .trim()
}

/**
 * Zone wall + Solo Focus H1 — complete sentence with a full stop (word limits unchanged).
 */
export function ensureHeadlineSentenceEnd(text: string): string {
  const t = stripHeadlineTerminalPunctuation(text)
  if (!t) return t
  return `${t}.`
}

const INCOMPLETE_HEADLINE_ENDINGS = new Set([
  'your',
  'the',
  'a',
  'an',
  'on',
  'in',
  'at',
  'to',
  'for',
  'with',
  'before',
  'after',
  'and',
  'or',
  'but',
  'of',
  'from',
  'by',
  'each',
  'every',
  'new',
  'one',
  'our',
  'my',
  'you',
  'not',
  'when',
  'what',
  'who',
  'why',
  'how',
  'which',
  'while',
  'although',
  'because',
  'since',
  'if',
  'unless',
  'that',
  'than',
  /* Bare trailing prepositions — always need an object ("materials slipping into" reads broken
   * even though "into" itself wasn't previously flagged). */
  'into',
  'onto',
  'upon',
  'through',
  'across',
  'towards',
  'toward',
])

/** Two-letter tokens that can end a valid zone stamp (e.g. EV, UK). */
const VALID_SHORT_HEADLINE_ENDINGS = new Set(['uk', 'ev', 'co', 'go', 'up', 'no', 'so', 'do'])

/** Headline ends on a article/preposition — not a complete stamp. */
function headlineEndsIncomplete(text: string): boolean {
  const words = splitHeadlineWords(text)
  if (words.length === 0) return true
  const last = words[words.length - 1].replace(/[^a-z]/gi, '').toLowerCase()
  if (INCOMPLETE_HEADLINE_ENDINGS.has(last)) return true
  /* Legacy 45-char DB clips — e.g. "…BEFORE YOU C" (mid-word). */
  if (last.length === 1) return true
  if (last.length === 2 && !VALID_SHORT_HEADLINE_ENDINGS.has(last)) return true
  return false
}

function trimHeadlineToMaxWords(
  text: string,
  maxWords: number,
  minWords = 1
): string {
  let words = splitHeadlineWords(text)
  if (words.length > maxWords) words = words.slice(0, maxWords)
  while (words.length > minWords && headlineEndsIncomplete(words.join(' '))) {
    words = words.slice(0, -1)
  }
  return words.join(' ')
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
 * Programmatic headline contract — Zone 8–10 words; expanded Solo Focus 20–24 words (hook, 2–3 lines).
 * @param expanded — when true, uses expanded hook bounds.
 */
export function enforceHeadlineWordLimits(
  text: string,
  expanded = false,
  journeyId?: JourneyId | string,
  bounds?: { min: number; max: number }
): string {
  const min = bounds?.min ?? (expanded ? MIN_EXPANDED_VIEW_HEADLINE_WORDS : MIN_ZONE_CARD_HEADLINE_WORDS)
  const max = bounds?.max ?? (expanded ? MAX_EXPANDED_VIEW_HEADLINE_WORDS : MAX_ZONE_CARD_HEADLINE_WORDS)
  const jid = journeyId ? coerceJourneyId(String(journeyId)) : undefined
  const journeyHook = jid ? (expanded ? EXPANDED_JOURNEY_HOOK[jid] : ZONE_BENTO_HOOK[jid]) : undefined
  const fallback = journeyHook ?? 'save money on home bills near you'
  const source =
    isGenericSpringHeadline(text) && journeyHook ? journeyHook : text
  const resolved = trimHeadlineToMaxWords(
    zoneCardHeadlineFromRaw(source, fallback, max).replace(/\.{3,}$|…$/g, '').trim(),
    max
  )
  const words = splitHeadlineWords(resolved)
  const needsHook =
    words.length < min ||
    headlineEndsIncomplete(resolved) ||
    (jid != null && headlineConflictsWithJourney(jid, resolved)) ||
    isLowQualityZoneHeadline(resolved)
  if (needsHook && journeyHook) {
    return ensureHeadlineSentenceEnd(
      trimHeadlineToMaxWords(
        zoneCardHeadlineFromRaw(journeyHook, journeyHook, max).replace(/\.{3,}$|…$/g, '').trim(),
        max,
        min
      )
    )
  }
  if (words.length < min) {
    const fb = trimHeadlineToMaxWords(
      zoneCardHeadlineFromRaw(fallback, fallback, max).replace(/\.{3,}$|…$/g, '').trim(),
      max,
      min
    )
    const fbWords = splitHeadlineWords(fb)
    return ensureHeadlineSentenceEnd(fbWords.length >= min ? fb : resolved)
  }
  return ensureHeadlineSentenceEnd(resolved)
}

export function zoneCardHeadlineFromRaw(
  raw: string,
  fallback: string,
  maxWords: number = MAX_ZONE_CARD_HEADLINE_WORDS
): string {
  const minWords = maxWords <= MAX_ZONE_CARD_HEADLINE_WORDS ? MIN_ZONE_CARD_HEADLINE_WORDS : MIN_EXPANDED_VIEW_HEADLINE_WORDS
  const candidates = [prepareZoneHeadlineSource(raw), prepareZoneHeadlineSource(fallback), fallback.trim()]
  for (const candidate of candidates) {
    if (!candidate || isLowQualityZoneHeadline(candidate)) continue
    const words = splitHeadlineWords(candidate)
    if (words.length === 0) continue
    return trimHeadlineToMaxWords(words.join(' '), maxWords, minWords)
  }
  const words = splitHeadlineWords(fallback)
  if (words.length === 0) return 'save money on home bills near you'
  return trimHeadlineToMaxWords(words.join(' '), maxWords, minWords)
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
      return words.slice(0, maxWords).join(' ')
    }
    return ''
  }
  const words = splitHeadlineWords(prepared)
  const minWords = maxWords <= MAX_ZONE_CARD_HEADLINE_WORDS ? MIN_ZONE_CARD_HEADLINE_WORDS : MIN_EXPANDED_VIEW_HEADLINE_WORDS
  return trimHeadlineToMaxWords(words.join(' '), maxWords, minWords)
}

/** Neon/agent fragment that is only a tail of the canonical journey hook — prefer full hook. */
function isPartialExpandedJourneyHook(resolved: string, journeyHook: string): boolean {
  const r = compactAlnumKey(resolved)
  const h = compactAlnumKey(journeyHook)
  if (r.length < 20 || h.length < 24 || r === h) return false
  return h.includes(r) && r.length <= h.length * 0.88
}

/**
 * Zone bento wall — 8–10 word Marvin stamp per journey (not Solo Focus).
 * Every entry must fit within MAX_ZONE_CARD_HEADLINE_WORDS (10) as written — trimHeadlineToMaxWords
 * will otherwise hard-slice these and can strand a dangling verb/adjective (e.g. "chase", "full")
 * that survives the INCOMPLETE_HEADLINE_ENDINGS check but still reads as a broken mid-clause cut.
 */
export const ZONE_BENTO_HOOK: Partial<Record<JourneyId, string>> = {
  home: 'seal draughts and loft gaps before buying a new boiler',
  utilities: 'check your tariff price before you lock in a deal',
  solar: 'size solar to your roof and the power you use',
  travel: 'swap one car commute for a train or bus trip',
  holidays: 'pick a train for short trips instead of flying',
  food: 'plan meals from food you already have to cut waste',
  shopping: 'repair and reuse home gear before buying something new',
  money: 'move idle cash to a better rate without hidden fees',
  tech: 'cut standby on plugs and chargers you leave on overnight',
  water: 'fix drips and fit aerators before your water bill climbs',
  waste: 'sort recycling and compost at home to cut bin charges',
  carbon: 'track one big habit each month and cut your waste',
}

/**
 * Discovery inject bento — distinct 8–10 word stamp when wall tile already uses ZONE_BENTO_HOOK.
 * Same 10-word ceiling constraint as ZONE_BENTO_HOOK above — keep every entry within it.
 */
const ZONE_GRID_INJECT_HOOK: Partial<Record<JourneyId, string>> = {
  home: 'check heat pump grant rules before booking an installer',
  utilities: 'match your meter read before you switch supplier plans',
  solar: 'book a roof survey before signing a solar export deal',
  travel: 'swap one car trip for rail before fuel costs rise',
  holidays: 'pick a train route for your next break before booking',
  food: 'plan meals from what is already in your fridge',
  shopping: 'repair one item this month before you buy another replacement',
  money: 'move idle cash before fees eat into your interest',
  tech: 'turn off standby on devices you leave on overnight',
  water: 'fit a tap aerator before your water bill rises',
  waste: 'set up food waste collection before landfill charges rise',
  carbon: 'log your biggest monthly habit before you buy offsets',
}

/**
 * Grid discovery / inject tip — 8–10 words; if it matches the journey wall tile headline, use prose or a distinct line.
 */
export function resolveZoneGridTipHeadline(
  tip: { title?: string; journey_key?: string; explanation?: string[] },
  journeyWallTitle?: string | null
): string {
  const jkey = tip.journey_key ?? 'carbon'
  const fallback = `${String(jkey).replace(/-/g, ' ').toUpperCase()} SAVING`
  let headline = clampZoneBentoHeadline(
    zoneCardHeadlineFromRaw(tip.title ?? '', fallback, MAX_ZONE_CARD_HEADLINE_WORDS),
    jkey
  )
  const wallKey = journeyWallTitle ? normalizeCardHeadlineKey(journeyWallTitle) : ''
  if (wallKey && normalizeCardHeadlineKey(headline) === wallKey) {
    const prose = (tip.explanation ?? []).map((p) => String(p).trim()).filter(Boolean).join('\n\n')
    const fromProse = prose.length >= 24 ? headlineFromArchitectProse(prose) : null
    if (fromProse) {
      headline = clampZoneBentoHeadline(fromProse, jkey)
    }
    if (normalizeCardHeadlineKey(headline) === wallKey) {
      const jid = coerceJourneyId(String(jkey)) ?? 'home'
      const injectHook = ZONE_GRID_INJECT_HOOK[jid]
      headline = clampZoneBentoHeadline(injectHook ?? `act on ${jkey.replace(/-/g, ' ')} this week`, jkey)
    }
  }
  return headline
}

/**
 * Zone bento face — enforce word bounds with per-journey hook fallback.
 * Today's Tips (Rock catalog) call this with no override → 8–10 words.
 * Journey mother cards pass `{ min: MIN_JOURNEY_CARD_HEADLINE_WORDS, max: MAX_JOURNEY_CARD_HEADLINE_WORDS }`
 * (9–12 words) — same stamp style, more room for locality + a figure.
 */
export function clampZoneBentoHeadline(
  text: string,
  journeyId?: JourneyId | string,
  bounds?: { min: number; max: number }
): string {
  const jid = journeyId ? coerceJourneyId(String(journeyId)) : undefined
  const hook = jid ? ZONE_BENTO_HOOK[jid] : undefined
  const raw = text?.trim() || hook || 'save money on home bills near you'
  const source =
    (isLowQualityZoneHeadline(raw) || isGenericSpringHeadline(raw)) && hook ? hook : raw
  return humanizeZoneHeadline(enforceHeadlineWordLimits(source, false, jid, bounds), jid)
}

/** Rock / Today's Tips — catalog habit titles (3–10 words); never substitute journey wall hooks. */
export function clampRockTipHeadline(title: string): string {
  const raw = (cleanZonePreviewHeadline(title) || title).trim()
  if (!raw) return title.trim()
  const trimmed = trimHeadlineToMaxWords(raw, MAX_ZONE_CARD_HEADLINE_WORDS, 2)
  return ensureHeadlineSentenceEnd(trimmed)
}

const HEADLINE_VERB_RE =
  /\b(?:save|cut|trim|switch|claim|apply|fit|fix|sort|track|move|reduce|stop|use|get|lock|shift|drop|keep|avoid|choose|check|book|plan|ride|charge|insulate|install|audit|lower|compare|refit|bleed|waste|spend|switching)\b/i

function headlineLacksVerb(text: string): boolean {
  return !HEADLINE_VERB_RE.test(text)
}

function stripTruncatedMoneyEllipsis(text: string): string {
  return text
    .replace(/£[\d,.]+[km]?\s*(?:\.{3,}|…)[^.!?]*$/gi, (m) => m.replace(/(?:\.{3,}|…).*$/, '').trim())
    .replace(/\.{3,}$|…$/g, '')
    .trim()
}

function padRockHeadlineToExpandedBounds(
  combined: string,
  journeyId?: JourneyId
): string {
  const jid = journeyId
  const journeyHook = jid ? EXPANDED_JOURNEY_HOOK[jid] : undefined
  let result = enforceHeadlineWordLimits(combined, true, jid)
  let words = splitHeadlineWords(result)
  if (words.length < 15 && journeyHook) {
    const padded = trimHeadlineToMaxWords(
      `${result} ${journeyHook}`,
      MAX_EXPANDED_VIEW_HEADLINE_WORDS,
      MIN_EXPANDED_VIEW_HEADLINE_WORDS
    )
    result = enforceHeadlineWordLimits(padded, true, jid)
    words = splitHeadlineWords(result)
  }
  if (words.length < MIN_EXPANDED_VIEW_HEADLINE_WORDS && journeyHook) {
    result = enforceHeadlineWordLimits(journeyHook, true, jid)
  }
  return humanizeZoneHeadline(result, jid)
}

/** Solo Focus for Rock habits — prefer insight as H1 when title is thin; body carries proof only. */
export function headlineFromRockHabitForSoloFocus(
  title: string,
  insight?: string,
  journeyId?: string
): string {
  const jid = journeyId ? coerceJourneyId(journeyId) : undefined
  const t = stripExpandedCardTitleNoise(cleanZonePreviewHeadline(title) || title).trim()
  const preparedTitle = prepareZoneHeadlineSource(t) || t
  const insightTrim = insight?.trim().replace(/\s+/g, ' ') ?? ''
  if (insightTrim && splitHeadlineWords(preparedTitle).length < MIN_EXPANDED_VIEW_HEADLINE_WORDS) {
    return padRockHeadlineToExpandedBounds(insightTrim, jid)
  }
  return padRockHeadlineToExpandedBounds(preparedTitle, jid)
}

/** @deprecated Rock grid face — use {@link headlineFromRockHabitForSoloFocus} in Solo Focus. */
export function headlineFromRockHabit(
  title: string,
  insight?: string,
  journeyId?: string
): string {
  const jid = journeyId ? coerceJourneyId(journeyId) : undefined
  const t = stripExpandedCardTitleNoise(cleanZonePreviewHeadline(title) || title).trim()
  let combined = prepareZoneHeadlineSource(t) || t
  const insightTrim = insight?.trim().replace(/\s+/g, ' ') ?? ''
  if (insightTrim && splitHeadlineWords(combined).length < MIN_EXPANDED_VIEW_HEADLINE_WORDS) {
    const titleKey = compactAlnumKey(combined)
    const insightKey = compactAlnumKey(insightTrim)
    const insightRepeatsTitle =
      (titleKey.length >= 8 && insightKey.includes(titleKey)) ||
      insightTrim.toLowerCase().startsWith(combined.toLowerCase())
    if (insightRepeatsTitle) {
      combined = trimHeadlineToMaxWords(
        insightTrim,
        MAX_EXPANDED_VIEW_HEADLINE_WORDS,
        MIN_EXPANDED_VIEW_HEADLINE_WORDS
      )
    } else {
      combined = trimHeadlineToMaxWords(
        `${combined}. ${insightTrim}`,
        MAX_EXPANDED_VIEW_HEADLINE_WORDS,
        2
      )
    }
  }
  return padRockHeadlineToExpandedBounds(combined, jid)
}

/** Expanded Solo Focus hook when DB title is thin or off-topic (~20 words each). */
const EXPANDED_JOURNEY_HOOK: Partial<Record<JourneyId, string>> = {
  travel:
    'TRY ONE TRAIN OR BUS TRIP A WEEK INSTEAD OF THE CAR COMMUTE AND CUT FUEL BILLS WITHOUT A NEW SEASON TICKET',
  holidays:
    'PICK SHORT TRIPS BY TRAIN INSTEAD OF FLYING WHEN YOU CAN AND KEEP MORE CASH ON HOLIDAY SPEND EACH YEAR',
  home:
    'SEAL DRAUGHTS AND LOFT GAPS AT HOME BEFORE YOU CHASE A NEW BOILER AND PAY FOR WASTED HEAT EACH WINTER',
  utilities:
    'LINE UP YOUR GAS AND ELECTRIC TARIFF BEFORE YOU LOCK IN A DEAL THAT BEATS WHAT YOU PAY NOW',
  solar:
    'SIZE SOLAR TO YOUR ROOF AND DAYTIME USE NOT A GENERIC KIT THAT EXPORTS POWER YOU NEVER USE AT HOME OR WORK',
  food:
    'PLAN MEALS AROUND WHAT YOU ALREADY HAVE IN THE CUPBOARD AND FRIDGE TO CUT FOOD WASTE AND SHOP SPEND EACH WEEK',
  shopping:
    'REPAIR AND REUSE HOME GEAR BEFORE YOU REPLACE ANOTHER ITEM AND SEND WORKING KIT STRAIGHT TO LANDFILL OR TIP',
  money:
    'MOVE IDLE CASH TO A CLEANER SAVINGS OR CURRENT ACCOUNT WITHOUT LOSING ACCESS OR PAYING HIDDEN FEES EVERY MONTH',
  tech:
    'CUT STANDBY DRAW ON PLUGS AND CHARGERS YOU LEAVE ON ALL NIGHT AND STOP QUIET ELECTRICITY LEAKS ADDING UP',
  water:
    'FIT AERATORS FIX DRIPS AND SHORT SHOWERS AT HOME BEFORE THE WATER METER TICKS UP AND YOUR BILL CLIMBS AGAIN',
  waste:
    'SORT RECYCLE AND COMPOST AT HOME EACH WEEK TO EASE COUNCIL BIN PRESSURE AND CUT WASTE CHARGES ON EVERY COLLECTION',
  carbon:
    'TRACK ONE BIG ENERGY HABIT AT HOME EACH MONTH AND TRIM WHAT YOU DO NOT NEED BEFORE YOU BUY OFFSETS OR KITS',
}

/** Expanded Solo Focus H1 — 20–24 word complete hook (never a dangling fragment). */
export function headlineFromExpandedHook(
  title: string,
  journeyId?: string
): string {
  const jid = journeyId ? coerceJourneyId(journeyId) : undefined
  const journeyHook = jid ? EXPANDED_JOURNEY_HOOK[jid] : undefined
  const prepared = stripTruncatedMoneyEllipsis(prepareZoneHeadlineSource(title))
  const resolved = enforceHeadlineWordLimits(prepared || title, true, jid)
  const words = splitHeadlineWords(resolved)
  const weak =
    isLowQualityZoneHeadline(resolved) ||
    isGenericSpringHeadline(resolved) ||
    isTruncatedSentence(resolved) ||
    words.length < MIN_EXPANDED_VIEW_HEADLINE_WORDS ||
    headlineEndsIncomplete(resolved) ||
    headlineLacksVerb(resolved) ||
    (jid != null && headlineConflictsWithJourney(jid, resolved)) ||
    Boolean(journeyHook && isPartialExpandedJourneyHook(resolved, journeyHook))
  if (jid && journeyHook && (weak || isGenericSpringHeadline(prepared || title))) {
    return humanizeZoneHeadline(enforceHeadlineWordLimits(journeyHook, true, jid), jid)
  }
  if (words.length < MIN_EXPANDED_VIEW_HEADLINE_WORDS && journeyHook) {
    return humanizeZoneHeadline(enforceHeadlineWordLimits(journeyHook, true, jid), jid)
  }
  if (headlineEndsIncomplete(resolved) && journeyHook) {
    return humanizeZoneHeadline(enforceHeadlineWordLimits(journeyHook, true, jid), jid)
  }
  return humanizeZoneHeadline(resolved, jid)
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
  /** Tip / morph card explicit BUY URL — wins over Neon when set. */
  cardOfferUrl?: string | null
  /** Tip / morph citation page — wins over Neon source when set. */
  cardSourceUrl?: string | null
  coverageOfferUrl?: string | null
  coverageSourceUrl?: string | null
  fallbackOfferUrl?: string | null
  fallbackSourceUrl?: string | null
  buildZaiUrl: () => string
}): { ctaUrl: string; offerUrl: string; sourceLinkUrl: string; ctaIsZai: boolean } {
  const j = coerceJourneyId(args.journeyKey)
  const pick = (u?: string | null) =>
    typeof u === 'string' && u.trim().startsWith('http') ? sanitizeZoneOfferUrl(u, j) : ''
  const offerUrl =
    pick(args.cardOfferUrl) || pick(args.coverageOfferUrl) || pick(args.fallbackOfferUrl)
  const sourceUrl =
    pick(args.cardSourceUrl) || pick(args.coverageSourceUrl) || pick(args.fallbackSourceUrl)
  const ctaIsZai = !offerUrl
  const ctaUrl = offerUrl || args.buildZaiUrl()
  return { ctaUrl, offerUrl, sourceLinkUrl: sourceUrl, ctaIsZai }
}

/** Primary CTA label synced to the resolved handoff URL (Claim / Buy / Get / Read / ASK ZAI). */
export function resolveSoloFocusCtaLabel(args: {
  journeyKey: string
  headline: string
  handoff: { ctaUrl: string; ctaIsZai: boolean }
  moneyGbp: number
  actionType?: string
  needsSwitching?: boolean
}): string {
  if (args.handoff.ctaIsZai || !args.handoff.ctaUrl.trim().startsWith('http')) {
    return 'ASK ZAI'
  }
  if (args.needsSwitching || args.actionType?.toLowerCase() === 'switch') {
    return resolveRevenueCtaLabel('swap', args.moneyGbp)
  }
  const fromUrl = inferZaiCtaLabel(args.journeyKey, args.headline, args.handoff.ctaUrl)
  if (fromUrl !== 'Read') return fromUrl
  const kind = inferRevenueCtaKind({
    journey: coerceJourneyId(args.journeyKey),
    actionType: args.actionType ?? '',
    needsSwitching: Boolean(args.needsSwitching),
    isPriorityHome: coerceJourneyId(args.journeyKey) === 'home',
  })
  return resolveRevenueCtaLabel(kind, args.moneyGbp)
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
    .filter(
      (p) =>
        p.length > 0 &&
        !COMPUTING_PLACEHOLDER_RE.test(p) &&
        !isGenericCalculationInsight(p)
    )
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
  /** Wall card id — rotates proof beats and session dedupe. */
  cardId?: string | null
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
      if (isGenericNonLocalityLead(sentences[0]!)) {
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
  const applyVariety = (text: string) => {
    const pruned = pruneDuplicateLocalityInsight(text, args.headline, args.auditHeaderLocality, args.journeyId)
    if (typeof window === 'undefined') return pruned
    return applySessionProseVariety(pruned, {
      cardId: args.cardId,
      journeyId: j,
      headline: args.headline,
      moneyGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      userPostcode: args.userPostcode,
      sourceDisplayName: args.sourceDisplayName,
      auditHeaderLocality: args.auditHeaderLocality,
    })
  }

  if (scraped && !GENERIC_SCRAPED.test(scraped)) {
    const joined = toParagraphs(scraped).join('\n\n')
    return applyVariety(joined)
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
    cardId: args.cardId ?? undefined,
  }).join('\n\n')
  return applyVariety(fallback)
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
        stripAuditorFluffParagraph(stripArchitectEmbeddedSectionTitles(p.trim())),
        j
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
      omitPayoff
        ? filtered.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS)
        : [filtered[0]!, filtered[1]!, third].slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS)
    )
    return collapseDuplicateProseParagraphs(packed.join('\n\n'))
  }
  if (filtered.length === 2) {
    if (omitPayoff) {
      return collapseDuplicateProseParagraphs(filtered.slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS).join('\n\n'))
    }
    const packed = dedupeTrueTipParagraphs(
      [filtered[0]!, filtered[1]!, payoffSentence(j, m, c)].slice(0, MAX_SOLO_FOCUS_PROSE_BLOCKS)
    )
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
  cardId?: string | null
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
    const fromNeon = buildResearchResultsTrueTipBody({
      architectProse: sanitizedAp,
      verifiedSavingGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      journeyId: args.journeyId,
    })
    if (typeof window === 'undefined') return fromNeon
    return applySessionProseVariety(fromNeon, {
      cardId: args.cardId,
      journeyId: jid,
      headline: args.headline,
      moneyGbp: args.moneyGbp,
      carbonKg: args.carbonKg,
      userPostcode: args.userPostcode,
      sourceDisplayName: args.sourceDisplayName,
      auditHeaderLocality: args.auditHeaderLocality,
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
    cardId: args.cardId,
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
    ])
      .filter((p) => p.trim().length > 0 && !isBoilerplateProseParagraph(p))
      .filter((p) => isCoherentParagraph(p))
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
    if (isGenericNonLocalityLead(only)) {
      return pack3(paras[0]!, paras[1] ?? paras[0]!, paras[2] ?? payoffSentence(j, money, carbon))
    }
    return pack3(only, paras[1] ?? paras[0]!, paras[2] ?? payoffSentence(j, money, carbon))
  }

  const t = collapseDuplicateProseParagraphs(stripProseReportLead(text.trim()))
  if (!t) {
    return ['', '', '']
  }
  const sanitized = sanitizeArchitectProseForJourney(j, t) ?? t
  const parts = sanitized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 3) {
    const coherent = parts.filter((p) => isCoherentParagraph(p))
    if (coherent.length >= 3) {
      return pack3(coherent[0]!, coherent[1]!, coherent[2]!)
    }
    return padFromSingle(coherent[0] ?? parts[0]!)
  }
  const sentences = sanitized
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
  return pack3(sanitized, sanitized, sanitized)
}
