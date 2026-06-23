import type { JourneyId } from '@/lib/journeys'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { isAcceptableZoneJourneyHeadline } from '@/lib/soloFocusCopy'
import { sanitizeArchitectProseForJourney } from '@/lib/zone/contentProseSanitize'
import { isCardVisited } from '@/lib/zone/visitedCards'
import { buildClientOfferAvoidHint } from '@/lib/zone/offerSignals'
import { resolveOnboardingResearchJourneys } from '@/lib/zone/onboardingResearchBootstrap'

import { readSessionRestoreProof } from '@/lib/client/sessionRestoreProofStorage'

function browserHasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((cookie) => cookie.trim().startsWith('session='))
}

export function browserCanTriggerScrapeSync(): boolean {
  if (typeof window === 'undefined') return false
  if (browserHasSessionCookie()) return true
  return Boolean(readSessionRestoreProof()?.trim())
}

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
  if (!browserCanTriggerScrapeSync()) return

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
  const avoidHint = buildClientOfferAvoidHint(cat)
  const mergedHint = [hint, avoidHint].filter(Boolean).join('\n\n')
  if (mergedHint.length > 0) {
    body.best_offer_hint = mergedHint.slice(0, 1200)
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

const ONBOARDING_JIT_STORAGE_KEY = 'zz_onboarding_jit_journeys'

function readOnboardingJitTriggered(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(ONBOARDING_JIT_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((v) => String(v).trim().toLowerCase()).filter(Boolean))
  } catch {
    return new Set()
  }
}

function markOnboardingJitTriggered(journeyKey: string): void {
  if (typeof window === 'undefined') return
  try {
    const set = readOnboardingJitTriggered()
    set.add(journeyKey.trim().toLowerCase())
    sessionStorage.setItem(ONBOARDING_JIT_STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

/**
 * Profile-complete + summary-exit seed — capped goal-aligned JIT scrapes (home, utilities, +2).
 * Dedupes within the browser session so profile submit + summary handshake do not double-fire.
 */
export function triggerOnboardingResearchBootstrap(params: {
  postcode: string | null | undefined
  profileData?: ResearchProfileData | null
  dedupe?: boolean
}): void {
  if (!browserCanTriggerScrapeSync()) return

  const pc = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) return

  const profileData = params.profileData ?? undefined
  const journeys = resolveOnboardingResearchJourneys({
    goal: profileData?.goal ?? profileData?.primary_goal,
    home_power: profileData?.home_power,
  })
  const triggered = params.dedupe === false ? new Set<string>() : readOnboardingJitTriggered()

  for (const journeyKey of journeys) {
    if (triggered.has(journeyKey)) continue
    markOnboardingJitTriggered(journeyKey)
    triggerScrapeSyncForCategory({
      postcode: pc,
      category: journeyKey,
      profileData,
    })
  }
}

/** Summary exit handshake — GET coverage, optional tips refresh, capped onboarding JIT. */
export async function runProfileResearchHandshake(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  signal?: AbortSignal
  includeTipsRefresh?: boolean
}): Promise<void> {
  const pc = params.postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return

  const requests: Promise<Response | void>[] = [
    fetch(`/api/scrape-sync?postcode=${encodeURIComponent(pc)}`, {
      credentials: 'include',
      signal: params.signal,
    }).catch(() => undefined),
  ]

  if (params.includeTipsRefresh !== false) {
    const { isAiRouteBlockedClient, markAiRouteBlockedFromStatus } = await import(
      '@/lib/intelligence/aiRouteClientGuard'
    )
    if (!isAiRouteBlockedClient()) {
      requests.push(
        fetch('/api/zone/tips-refresh', {
          method: 'POST',
          credentials: 'include',
          signal: params.signal,
        })
          .then((r) => {
            markAiRouteBlockedFromStatus(r.status)
            return r
          })
          .catch(() => undefined)
      )
    }
  }

  triggerOnboardingResearchBootstrap({
    postcode: pc,
    profileData: params.profileData,
    dedupe: true,
  })

  await Promise.allSettled(requests)
}

/** Tier 2 scoped refresh — GET with category + answer (see `fetchTier2ScrapeSync`). */
export { fetchTier2ScrapeSync } from '@/lib/zone/tier2RecursiveSpawner'
