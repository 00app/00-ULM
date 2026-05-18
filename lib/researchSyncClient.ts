import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { ensureClientResearchUserId, resolveClientResearchUserId } from '@/lib/zone/garyMode'

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

/** Card / Solo Focus can render when Neon has £, offer URL, headline, or prose — not prose-only. */
export function journeyResearchSettled(
  row: ResearchCategoryCoverageRow | undefined | null,
  opts?: { streamPending?: boolean }
): boolean {
  if (opts?.streamPending === false) return true
  if (!row) return false
  if (row.insightReady) return true
  if ((row.latestSavingGbp ?? 0) > 0 || (row.latestVerifiedGbp ?? 0) > 0) return true
  if (row.hasOffer) return true
  if (row.agentHeadline?.trim()) return true
  if (row.architectProse?.trim()) return true
  return false
}

/**
 * Fire-and-forget POST /api/scrape-sync (trigger mode) for a single journey category
 * after Solo Focus answers — Hermes / ZeroResearch persists `research_results` scoped by category.
 */
export function triggerScrapeSyncForCategory(params: {
  postcode: string | null | undefined
  category: string
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
  const cat = String(params.category ?? '')
    .trim()
    .toLowerCase()
  if (!cat) return
  const researchUserId = ensureClientResearchUserId(pc) ?? resolveClientResearchUserId()
  const body: Record<string, unknown> = {
    trigger: true,
    postcode: pc,
    category: cat,
    profileData: params.profileData && Object.keys(params.profileData).length > 0 ? params.profileData : undefined,
    ...(researchUserId ? { user_id: researchUserId } : {}),
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
