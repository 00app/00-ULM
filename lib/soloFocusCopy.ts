/**
 * Solo Focus v1.8.3 — shared headline + insight/RESULT asterisk logic (one template, dual entry).
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { sanitizeAgentMarkdown, stripMarkdownForProseDisplay } from '@/lib/agents/zeroHunterMarkdown'
import { bridgeSentence, buildAuditorNarrativeParagraphs } from '@/lib/zone/auditorNarrative'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'

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
  /\b(?:BN\d|POSTCODE|REGULATORY|AUDIT|REPORT|REGIONAL|PROFILE|DNO|UKPN|APRIL\s*2026|ENERGY\s+AUDIT|LITTLEHAMPTON|ARUN|SOUTH\s+EAST|DISTRIB|STANDING\s+CHARGE|UNIT\s+RATE|KWH|KWH\/|PRICE\s+CAP|OFgem|GOVERNMENT\s+DATA)\b/i

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
  let t = raw.replace(/\*{2,3}/g, '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/\b[A-Z]{1,2}\d[A-Z0-9]?\s?\d[A-Z]{2}\b/gi, '')
  t = t.replace(
    /\b(?:energy\s+audit(?:\s+report)?|audit\s+report|regional\s+(?:energy\s+)?profile|grant\s+eligibility)[:\s-]*/gi,
    ''
  )
  t = t.replace(
    /\b(?:AUDIT|RESULT|REPORT|OUTLOOK|ENERGY|REGULATORY|WINDOW|HOUSEHOLD|POSTCODE|REGIONAL|PROFILE|SOURCE)\b:?/gi,
    ''
  )
  if (t.includes(':')) {
    const parts = t.split(':').map((p) => p.trim()).filter(Boolean)
    const meat = parts.find((p) => p.length >= 6 && !isZonePreviewHeadlineNoise(p))
    if (meat) t = meat
    else if (parts.length > 0) t = parts[parts.length - 1]!
  }
  t = t.replace(/\s+/g, ' ').trim()
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
export function stripAuditorFluffParagraph(raw: string): string {
  return raw
    .replace(
      /^(?:did you know\??|consider (?:this|that)\.?\s*|fun fact:?\s*|here'?s (?:the thing|what you need to know):?\s*)/i,
      ''
    )
    .trim()
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
    return `Behind this headline sits a live scheme from your audit trail — the £ and CO₂e figures are pathway estimates tied to your postcode and eligibility signals, not boilerplate.`
  }
  if (h.length >= 18 && fpKey.includes(h)) {
    return `Behind this headline sits a live scheme from your audit trail — the £ and CO₂e figures are pathway estimates tied to your postcode and eligibility signals, not boilerplate.`
  }
  return firstParagraph
}

export function polishTrueTipParagraphsForHeadline(
  headline: string,
  paras: [string, string, string]
): [string, string, string] {
  const [a, b, c] = paras
  return [
    humanizeTrueTipParagraph(dedupeTrueTipOpeningParagraph(headline, a)),
    humanizeTrueTipParagraph(b),
    humanizeTrueTipParagraph(c),
  ]
}

/** Zone / bento card face — Marvin stamp (6–8 words). */
export const MIN_ZONE_CARD_HEADLINE_WORDS = 6
export const MAX_ZONE_CARD_HEADLINE_WORDS = 8
/** Solo Focus / expanded Zai Architect H1 (6–12 words). */
export const MIN_EXPANDED_VIEW_HEADLINE_WORDS = 6
export const MAX_EXPANDED_VIEW_HEADLINE_WORDS = 12
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
  return tariffSignals || tabley
}

export function humanizeTrueTipParagraph(raw: string): string {
  const cleaned = stripMarkdownForProseDisplay(stripArchitectEmbeddedSectionTitles(raw), 900)
  return clampWords(cleaned, MAX_TRUE_TIP_PARAGRAPH_WORDS)
}

const SHORT_HEADLINE_PAD = [
  'ON',
  'YOUR',
  'ZONE',
  'WALL',
  'RIGHT',
  'NOW',
  'THIS',
  'MONTH',
  'AT',
  'HOME',
] as const

function padHeadlineToMin(words: string[], minWords: number, maxWords: number): string[] {
  if (words.length >= minWords) return words.slice(0, maxWords)
  const out = [...words]
  for (const w of SHORT_HEADLINE_PAD) {
    if (out.length >= minWords) break
    out.push(w)
  }
  return out.slice(0, maxWords)
}

/** Normalize headline text for duplicate card detection on the Zone wall. */
export function normalizeCardHeadlineKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Marvin headline — pads short sources to minWords, clips at maxWords. */
export function headlineFromTitle(
  title: string,
  maxWords: number = MAX_ZONE_CARD_HEADLINE_WORDS,
  minWords?: number
): string {
  const defaultMin =
    maxWords <= MAX_ZONE_CARD_HEADLINE_WORDS
      ? MIN_ZONE_CARD_HEADLINE_WORDS
      : MIN_EXPANDED_VIEW_HEADLINE_WORDS
  const min = Math.min(minWords ?? defaultMin, maxWords)
  const words = title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/\.{2,}|…$/g, ''))
  const sized = padHeadlineToMin(words, min, maxWords)
  if (sized.length <= maxWords) return sized.join(' ')
  return `${sized.slice(0, maxWords).join(' ')}...`
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
  coverageOfferUrl?: string | null
  coverageSourceUrl?: string | null
  fallbackOfferUrl?: string | null
  fallbackSourceUrl?: string | null
  buildZaiUrl: () => string
}): { ctaUrl: string; offerUrl: string; sourceLinkUrl: string; ctaIsZai: boolean } {
  const pick = (u?: string | null) =>
    typeof u === 'string' && u.trim().startsWith('http') ? u.trim() : ''
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
  const rawClean = stripMarkdownForProseDisplay(
    stripProseReportLead(stripArchitectEmbeddedSectionTitles(params.architectProse.trim())),
    4000
  )
  const blocks = rawClean
    .split(/\n\s*\n/)
    .map((p) => humanizeTrueTipParagraph(stripArchitectEmbeddedSectionTitles(p.trim())))
    .filter(Boolean)
  const m = Math.max(0, Math.round(params.verifiedSavingGbp))
  const c = Math.max(0, Math.round(params.carbonKg))
  const whyLine = `At today’s pathway numbers you are looking at about £${formatMoneyValue(m)} a year back in the pocket and roughly ${formatCarbonValue(c)} CO₂e — grounded in your stored audit and research row, not a filler estimate.`
  if (blocks.length >= 3) {
    return blocks.slice(0, 3).join('\n\n')
  }
  if (blocks.length === 2) {
    return [blocks[0]!, blocks[1]!, bridgeSentence(j)].join('\n\n')
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
  const what = blocks[0] ?? rawClean
  return [what, whyLine, bridgeSentence(j)].join('\n\n')
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
  if (args.verifiedAuditMatchesJourney && ap.length > 0 && !isRawResearchDump(ap)) {
    return buildResearchResultsTrueTipBody({
      architectProse: ap,
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
export function toThreeTrueTipParagraphs(text: string): [string, string, string] {
  const pack3 = (a: string, b: string, c: string): [string, string, string] =>
    [
      humanizeTrueTipParagraph(stripAuditorFluffParagraph(a)),
      humanizeTrueTipParagraph(stripAuditorFluffParagraph(b)),
      humanizeTrueTipParagraph(stripAuditorFluffParagraph(c)),
    ]

  const t = stripProseReportLead(text.trim())
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
    return pack3(
      sentences[0]!,
      sentences[1]!,
      'Open the verified source link below to complete this action and lock in the saving.'
    )
  }
  if (sentences.length === 1) {
    return pack3(
      sentences[0]!,
      `This maps to the £ and kg figures shown — wallet and footprint move together when you act.`,
      `Use the primary action below to claim the saving or change the behaviour; the source line confirms the live audit trail.`
    )
  }
  return pack3(t, t, t)
}
