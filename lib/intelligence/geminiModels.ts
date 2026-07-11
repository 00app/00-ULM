/**
 * Ulm / JIT model split — Flash / Flash-Lite for direct API + gateway.
 * Override via env without code changes (see `.env.example`).
 * Set GEMINI_FREE_TIER=1 for cheaper Google models (still counts toward AI Studio cap if key is paid).
 */

import { ZONE_WARM_AUDITOR_THREE_BEAT, ZONE_WARM_AUDITOR_VOICE } from '@/lib/zone/zoneVoice'

export type GeminiModelTier = 'zone' | 'article' | 'chat'

/** Forensic triplet + Zai — low temperature, minimal token waste. */
export const GEMINI_PRECISION_TEMPERATURE = 0.2

function isGeminiFreeTierEnv(): boolean {
  const v = process.env.GEMINI_FREE_TIER?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Direct API model id (v1beta). Free-tier env uses the Flash-Lite alias; else the Flash alias.
 * Use the "-latest" aliases, not dated model ids (gemini-2.5-flash, gemini-2.0-flash-lite) — Google
 * retires dated ids for new API-key projects ("this model is no longer available to new users"),
 * which silently killed Gemini in production (confirmed live 2026-07-11: 404 on gemini-2.5-flash,
 * 0-quota on gemini-2.0-flash-lite, both fine on the "-latest" aliases with the same key).
 */
export const FLASH_DEFAULT = isGeminiFreeTierEnv() ? 'gemini-flash-lite-latest' : 'gemini-flash-latest'

/** Direct `@google/generative-ai` model IDs (no `google/` prefix). */
export const GEMINI_DIRECT_ZONE =
  process.env.GEMINI_ZONE_MODEL?.trim() || FLASH_DEFAULT
export const GEMINI_DIRECT_ARTICLE =
  process.env.GEMINI_ARTICLE_MODEL?.trim() || FLASH_DEFAULT
export const GEMINI_DIRECT_CHAT =
  process.env.GEMINI_CHAT_MODEL?.trim() || FLASH_DEFAULT

/** Vercel AI Gateway slugs (`google/…`). */
export const GEMINI_GATEWAY_ZONE =
  process.env.AI_GATEWAY_MODEL_ZONE?.trim() || `google/${FLASH_DEFAULT}`
export const GEMINI_GATEWAY_ARTICLE =
  process.env.AI_GATEWAY_MODEL_ARTICLE?.trim() || `google/${FLASH_DEFAULT}`
export const GEMINI_GATEWAY_CHAT =
  process.env.AI_GATEWAY_MODEL_CHAT?.trim() || `google/${FLASH_DEFAULT}`

/** iChat / Zai — Flash only (no Pro; avoids 429 credit caps). */
export const CHAT_GATEWAY_MODEL_CHAIN = [
  GEMINI_GATEWAY_CHAT,
  GEMINI_GATEWAY_ZONE,
].filter((v, i, a) => a.indexOf(v) === i)

/** Zone cards, scrape-sync deep pass, triplet headlines. */
export const ZONE_GATEWAY_MODEL_CHAIN = [
  GEMINI_GATEWAY_ZONE,
  GEMINI_GATEWAY_ARTICLE,
].filter((v, i, a) => a.indexOf(v) === i)

/** Expanded architect prose (3 paragraphs). */
export const ARTICLE_GATEWAY_MODEL_CHAIN = [
  GEMINI_GATEWAY_ARTICLE,
  GEMINI_GATEWAY_ZONE,
].filter((v, i, a) => a.indexOf(v) === i)

/** @deprecated Use {@link ZONE_GATEWAY_MODEL_CHAIN} — kept for imports; no Pro/Claude. */
export const RESEARCH_GATEWAY_MODEL_CHAIN = ZONE_GATEWAY_MODEL_CHAIN

/** Lead Auditor — Zai chat + shared research guardrails. */
export const ULM_LEAD_AUDITOR_SYSTEM = `You are Zai, the Lead Auditor for Zero Zero. Voice: calm UK mate who has read the bills so the user does not have to — plain English only, no scheme acronyms (never BUS, ECO4, MCS, ULEZ in user-facing copy; say heat pump grant, home insulation grant, certified installer).
Logic: 12k kWh ≈ 1 tonne CO₂e baseline.
Constraints: Exactly 3 paragraphs when architect_prose is requested; heading max 12 words for expanded view.
Boundaries: If the user drifts off household savings, gently steer back — no "signal noise" coldness.
Learning: Every clicked link is a Suggestion saved to the DB.`

export const EDITORIAL_MAGAZINE_CONSTRAINT = `${ULM_LEAD_AUDITOR_SYSTEM}

${ZONE_WARM_AUDITOR_VOICE}

${ZONE_WARM_AUDITOR_THREE_BEAT}

CRITICAL: UK English, human benefit first. No bullet points. Never open with "Here is your advice" or "As an AI". No dashboard field names. Use town/locality in paragraph 1 — never spell out a full postcode in architect_prose. Payoff (£/kg) appears once in paragraph 3 only.`

export function resolveGeminiTier(tag?: string | null): GeminiModelTier {
  const t = (tag ?? '').toLowerCase()
  if (t.includes('zai') || t.includes('chat') || t.includes('hint') || t.includes('ichat')) {
    return 'chat'
  }
  if (
    t.includes('architect') ||
    t.includes('triplet') ||
    t.includes('article') ||
    t.includes('prose') ||
    t.includes('expanded')
  ) {
    return 'article'
  }
  return 'zone'
}

export function directModelForTier(tier: GeminiModelTier): string {
  switch (tier) {
    case 'article':
      return GEMINI_DIRECT_ARTICLE
    case 'chat':
      return GEMINI_DIRECT_CHAT
    default:
      return GEMINI_DIRECT_ZONE
  }
}

export function gatewayModelsForTier(tier: GeminiModelTier): string[] {
  switch (tier) {
    case 'article':
      return [...ARTICLE_GATEWAY_MODEL_CHAIN]
    case 'chat':
      return [...CHAT_GATEWAY_MODEL_CHAIN]
    default:
      return [...ZONE_GATEWAY_MODEL_CHAIN]
  }
}

/** Map gateway slug → direct API model id. */
export function gatewaySlugToDirectModel(slug: string): string {
  const s = slug.trim()
  if (s.startsWith('google/')) return s.slice('google/'.length)
  return s
}
