/**
 * May 2026 model split — Flash-Lite for zone + chat, Flash for 3-paragraph articles.
 * Override via env without code changes (see `.env.example`).
 */

export type GeminiModelTier = 'zone' | 'article' | 'chat'

/** Direct `@google/generative-ai` model IDs (no `google/` prefix). */
export const GEMINI_DIRECT_ZONE =
  process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-2.5-flash-lite'
export const GEMINI_DIRECT_ARTICLE =
  process.env.GEMINI_ARTICLE_MODEL?.trim() || 'gemini-2.5-flash'
export const GEMINI_DIRECT_CHAT =
  process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-2.5-flash-lite'

/** Vercel AI Gateway slugs (`google/…`). */
export const GEMINI_GATEWAY_ZONE =
  process.env.AI_GATEWAY_MODEL_ZONE?.trim() || 'google/gemini-2.5-flash-lite'
export const GEMINI_GATEWAY_ARTICLE =
  process.env.AI_GATEWAY_MODEL_ARTICLE?.trim() || 'google/gemini-2.5-flash'
export const GEMINI_GATEWAY_CHAT =
  process.env.AI_GATEWAY_MODEL_CHAT?.trim() || 'google/gemini-2.5-flash-lite'

/** iChat / Zai — lite only (no Pro; avoids 429 credit caps). */
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

export const EDITORIAL_MAGAZINE_CONSTRAINT = `CRITICAL: Write as a forensic auditor for Monocle — UK English, human benefit first. No bullet points. Never open with "Here is your advice", "As an AI", or repeat the postcode twice in one sentence (e.g. avoid "in BN17 area, in the BN17 area"). No dashboard field names, API jargon, or lines like "your zone pattern is learned". Exactly three paragraphs in architect_prose when requested: (1) localized why for the user's town, (2) the £ and kg logic, (3) one concrete next step.`

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
