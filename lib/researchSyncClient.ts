import type { JourneyId } from '@/lib/journeys'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { isAcceptableZoneJourneyHeadline } from '@/lib/soloFocusCopy'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'
import { isCardVisited } from '@/lib/zone/visitedCards'

/** Latest row per `research_results.category` from GET /api/scrape-sync. */
export type ResearchCategoryCoverageRow = {
  insightReady: boolean
  hasOffer: boolean
  verified: boolean
  latestSavingGbp: number | null
  latestVerifiedGbp: number | null
  latestOfferUrl: string | null
  /** `research_results.source_url` when present (authoritative page, distinct from offer). */
  latestSourceUrl: string | null
  /** Latest label-free prose for this category. */
  architectProse?: string | null
  /** ~20-word auditor headline when architect_prose is not yet persisted. */
  agentHeadline?: string | null
}

/** Card / Solo Focus can render when Neon has journey-valid £, offer URL, headline, or prose. */
export function journeyResearchSettled(
  row: ResearchCategoryCoverageRow | undefined | null,
  opts?: { streamPending?: boolean; journeyId?: JourneyId }
): boolean {
  if (opts?.streamPending === false) return true
  if (!row) return false
  const jid = opts?.journeyId
  const proseOk =
    row.architectProse?.trim() &&
    (!jid || sanitizeArchitectProseForJourney(jid, row.architectProse) != null)
  const headlineOk =
    row.agentHeadline?.trim() &&
    (!jid || isAcceptableZoneJourneyHeadline(jid, row.agentHeadline))
  if (row.insightReady && (proseOk || headlineOk || row.hasOffer || (row.latestSavingGbp ?? 0) > 0)) {
    return true
  }
  if ((row.latestSavingGbp ?? 0) > 0 || (row.latestVerifiedGbp ?? 0) > 0) {
    return Boolean(proseOk || headlineOk || row.hasOffer)
  }
  if (row.hasOffer && (proseOk || headlineOk)) return true
  if (headlineOk) return true
  if (proseOk) return true
  return false
}

/**
 * Fire-and-forget POST /api/scrape-sync (trigger mode) for a single journey category.
 * **Not** for `/zai` chat turns — see `lib/zai/chatBoundaries.ts` (JIT allowed: answers, tip +1, deep-dive Search deeper, Zone GET).
 * after Solo Focus answers — Hermes / ZeroResearch persists `research_results` scoped by category.
 */
export function triggerScrapeSyncForCategory(params: {
  postcode: string | null | undefined
  category: string
  /** Pink persistence — skip Firecrawl/Gemini if this card already earned a deep scrape. */
  cardId?: string | null
  profileData?: ResearchProfileData | null
  /** Appended to scrape-sync user context for best-offer / action URL pivots (solo focus completion). */
  bestOfferHint?: string | null
  /** Pattern arbitrage pass (rail vs flight, EV swap, local holidays). */
  lifestyleShift?: boolean
  questionId?: string | null
  answerValue?: string | null
  isAchievementCard?: boolean
}): void {
  const pc = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) return
  const cardId = typeof params.cardId === 'string' ? params.cardId.trim() : ''
  if (cardId && isCardVisited(cardId)) return
  const cat = String(params.category ?? '')
    .trim()
    .toLowerCase()
  if (!cat) return
  const body: Record<string, unknown> = {
    trigger: true,
    postcode: pc,
    journey_key: cat,
    category: cat,
    profileData: params.profileData && Object.keys(params.profileData).length > 0 ? params.profileData : undefined,
  }
  const hint = typeof params.bestOfferHint === 'string' ? params.bestOfferHint.trim() : ''
  if (hint.length > 0) {
    body.best_offer_hint = hint.slice(0, 1200)
  }
  if (params.lifestyleShift) {
    body.lifestyle_mode = 'shift'
    body.is_achievement_card = params.isAchievementCard !== false
  }
  const qid = typeof params.questionId === 'string' ? params.questionId.trim() : ''
  const ans = typeof params.answerValue === 'string' ? params.answerValue.trim() : ''
  if (qid) body.question_id = qid
  if (ans) body.answer_value = ans
  void fetch('/api/scrape-sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    /* non-blocking */
  })
}

/** Tier 2 scoped refresh — GET with category + answer (see `fetchTier2ScrapeSync`). */
export { fetchTier2ScrapeSync } from '@/lib/zone/tier2RecursiveSpawner'
