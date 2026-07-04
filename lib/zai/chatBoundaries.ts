/**
 * Mechanical Truth — functional boundaries between Onboarding, Zone, and Zai Chat.
 * Prevents redundant scrapes, overlapping question banks, and uncontrolled search.
 */

import { isForbiddenQuestion, ZAI_BOUNDARIES } from '@/lib/brains/zai/boundaries'

/** Surfaces allowed to trigger JIT category scrape (`POST /api/scrape-sync`). */
export const ZAI_SCRAPE_ALLOWED_SURFACES = [
  'zone_answer_loop', // POST /api/answers → server discovery race
  'tip_verification_plus_one', // runTipVerificationDeepScrape
  'ask_zai_deep_dive_search_deeper', // AskZaiDeepDiveSheet submit only
  'profile_postcode_step', // profile completion locality seed
  'zone_hydration_get', // GET scrape-sync read/repair on Zone load
] as const

/** Surfaces barred from initiating scrape or broad research. */
export const ZAI_SCRAPE_FORBIDDEN_SURFACES = [
  'zai_chat_turn', // POST /api/zai — read Neon + transcript only
  'zai_chat_continue_in_zai', // handoff is read-only until user sends next message
  'zai_close_audit_complete', // refresh VM only, no scrape
  'visited_card_close', // pink visited — no inject / trap / tips-refresh
] as const

export type ZaiScrapeAllowedSurface = (typeof ZAI_SCRAPE_ALLOWED_SURFACES)[number]
export type ZaiScrapeForbiddenSurface = (typeof ZAI_SCRAPE_FORBIDDEN_SURFACES)[number]

/** Zai chat + Deep Dive — read-only interpreter; Zone cards own editorial 3-beat prose. */
export const ZAI_READ_ONLY_TRUTH_RULES = {
  allowedSources: [
    'user_genome',
    'research_results',
    'buildUserImpact totals',
    'journey_answers',
    'expandedContext / StoredExpandCard handoff',
    'open_data_anchor in genome',
  ] as const,
  noInventedSavings: true,
  noRepeatCardThreeBeat: true,
  noWebBrowseOnChatSurface: true,
  ulmBaselineHint: '12,000 kWh ≈ 1 tonne CO₂e — interpret only when totals exist in context',
} as const

export const ZAI_CHAT_EDITORIAL_RULES = {
  threeBeat: ['detection', 'proof', 'directive'] as const,
  noMarkdownHeadings: true,
  noBoldSectionLabels: true,
  sentenceCaseProse: true,
  noApologyPhrases: [
    'as an ai',
    'as a language model',
    'i apologize',
    'i apologise',
    'sorry,',
    "i'm sorry",
  ],
  /** Robotic cheer — strip and fall back to uncertain copy. */
  bannedOpeners: [
    'sure, i can help',
    'sure!',
    'sure,',
    'great question',
    'great choice',
    'absolutely',
    'of course',
    'happy to help',
    'i would be happy to',
    'certainly!',
  ],
  maxTranscriptTurns: 20,
} as const

export const ZAI_FALLBACK_UNCERTAIN =
  "I don't have enough information to be confident on that one. Let's stick to your bills or travel moves."

/** Shown when postcode + journey answers + totals are all missing — genuinely different case
 * from ZAI_FALLBACK_UNCERTAIN (an off-topic/uncertain reply). This one must never contradict
 * the question that was just asked, since it can fire in response to the app's own suggested
 * prompts ("cut home energy bills") — telling the user to "stick to bills" after they already
 * asked about bills read as broken. Give them a concrete next step instead. */
export const ZAI_FALLBACK_NEEDS_CONTEXT =
  "I don't have your postcode or profile answers yet, so I can't give you real numbers. Tell me your postcode here, or finish your profile, and I'll dig into actual savings for your area."

export const ZAI_FALLBACK_CONNECTING = "Give me a sec — still checking what's live near you."

export const ZAI_FORBIDDEN_TOPIC_DECLINE =
  "I cannot offer financial, legal, or medical advice. Let's stay focused on your home energy or travel moves."

export function isZaiChatSurface(surface: string): boolean {
  return surface === 'zai_chat_turn' || surface === 'zai_chat_continue_in_zai'
}

export function assertNoScrapeOnZaiChat(surface: string): void {
  if (isZaiChatSurface(surface)) {
    throw new Error(`[mechanical-truth] scrape blocked on surface: ${surface}`)
  }
}

export function getZaiDeclineForQuestion(question: string): string | null {
  if (isForbiddenQuestion(question)) return ZAI_FORBIDDEN_TOPIC_DECLINE
  return null
}

/** Strip markdown structure from model output — beats live in plain sentences only. */
export function stripZaiChatMarkdown(text: string): string {
  let t = text.trim()
  if (!t) return ZAI_FALLBACK_UNCERTAIN
  const lower = t.toLowerCase()
  for (const phrase of ZAI_CHAT_EDITORIAL_RULES.noApologyPhrases) {
    if (lower.includes(phrase)) {
      return ZAI_FALLBACK_UNCERTAIN
    }
  }
  for (const opener of ZAI_CHAT_EDITORIAL_RULES.bannedOpeners) {
    if (lower.startsWith(opener) || lower.includes(`\n${opener}`)) {
      t = t.replace(new RegExp(`^${opener}[^.!?]*[.!?]?\\s*`, 'i'), '').trim()
    }
  }
  t = t
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^(what|why|how|detection|proof|directive)\s*:\s*/gim, '')
    .replace(/!+/g, '.')
  return t.trim() || ZAI_FALLBACK_UNCERTAIN
}

/** True when we lack postcode, journey answers, and non-zero impact to ground a reply. */
export function lacksGroundedZaiContext(params: {
  postcode?: string | null
  journeyAnswerKeys: number
  totalMoney: number
  totalCarbon: number
}): boolean {
  const pc = params.postcode?.replace(/\s+/g, '').trim() ?? ''
  const hasPostcode = pc.length >= 4
  const hasAnswers = params.journeyAnswerKeys > 0
  const hasTotals = params.totalMoney > 0 || params.totalCarbon > 0
  return !hasPostcode && !hasAnswers && !hasTotals
}

export { ZAI_BOUNDARIES }
