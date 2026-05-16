import type { JourneyId } from '@/lib/journeys'
import { isValidJourneyQuestion } from '@/lib/journeys'
import { researchCategoryToJourneyKey } from '@/lib/zone/neonResearchMerge'
import { appendResearchUserIdQuery, resolveClientResearchUserId } from '@/lib/zone/garyMode'
import { safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'
import { persistUnifiedUserProfileMemory, UNIFIED_PROFILE_MEMORY_EVENT } from '@/lib/unifiedProfileMemory'
import {
  parseCoverageFromApi,
  parseResearchMetaFromApi,
  type ParsedResearchMeta,
} from '@/lib/zone/parseScrapeSyncClient'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { getNextMorphCard } from '@/lib/zone/getNextMorphCard'

export { GARY_RESEARCH_USER_ID } from '@/lib/zone/garyMode'

export type Tier2ScrapeSyncResult = {
  ok: boolean
  category: string
  coverage: Record<string, ResearchCategoryCoverageRow> | null
  meta: ParsedResearchMeta | null
  morphCard: ZoneTipCard | null
  offerUrl: string | null
}

function isValidUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim())
}

export function readBrowserResearchUserId(): string | null {
  return resolveClientResearchUserId()
}

export const TIER2_PROFILE_REFRESH_EVENT = 'zz-tier2-profile-refresh'

/** Mirror POST /api/answers local state so Summary + Zone hero totals refresh without reload. */
export function persistTier2AnswerLocal(params: {
  journeyId: string
  questionId: string
  answer: string
}): void {
  if (typeof window === 'undefined') return
  const journeyId = params.journeyId.trim().toLowerCase() as JourneyId
  const questionId = params.questionId.trim()
  const answer = params.answer.trim()
  if (!journeyId || !questionId || !answer) return
  if (!isValidJourneyQuestion(journeyId, questionId)) return
  try {
    const key = `journey_${journeyId}_answers`
    const prev = safeGetItem(key)
    const map = prev ? (JSON.parse(prev) as Record<string, string>) : {}
    map[questionId] = answer
    safeSetItem(key, JSON.stringify(map))
    persistUnifiedUserProfileMemory()
    window.dispatchEvent(new Event(TIER2_PROFILE_REFRESH_EVENT))
    window.dispatchEvent(new Event(UNIFIED_PROFILE_MEMORY_EVENT))
  } catch {
    /* quota / privacy */
  }
}

/** Re-fetch scrape-sync coverage and push hero totals into AppContext listeners. */
export async function refreshZoneTotalsAfterTier2(postcode: string): Promise<void> {
  if (typeof window === 'undefined') return
  const pc = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return
  try {
    const url = appendResearchUserIdQuery(`/api/scrape-sync?postcode=${encodeURIComponent(pc)}`)
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    const scraped = Array.isArray(data?.scraped) ? data.scraped : []
    let totalMoney = 0
    let totalCarbon = 0
    for (const row of scraped) {
      if (!row || typeof row !== 'object') continue
      const m = Number((row as { money_value?: unknown }).money_value)
      const c = Number((row as { carbon_value?: unknown }).carbon_value)
      if (Number.isFinite(m)) totalMoney += m
      if (Number.isFinite(c)) totalCarbon += c
    }
    window.dispatchEvent(
      new CustomEvent(TIER2_PROFILE_REFRESH_EVENT, {
        detail: { totalMoney, totalCarbon, coverage: data?.research_category_coverage ?? null },
      })
    )
  } catch {
    /* non-blocking */
  }
}

export function openOfferUrlInNewTab(url: string | null | undefined): boolean {
  const u = typeof url === 'string' ? url.trim() : ''
  if (!u.startsWith('http')) return false
  try {
    window.open(u, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}

export function buildTier2MorphCard(
  journeyId: JourneyId,
  coverage: Record<string, ResearchCategoryCoverageRow> | null,
  meta: ParsedResearchMeta | null,
  profile?: { postcode?: string; homeType?: string | null; transport?: string | null }
): ZoneTipCard {
  const catKey = journeyId.toLowerCase()
  const row =
    coverage?.[catKey] ??
    coverage?.[researchCategoryToJourneyKey(catKey) ?? ''] ??
    null
  const offerUrl =
    row?.latestOfferUrl?.trim().startsWith('http')
      ? row.latestOfferUrl.trim()
      : row?.latestSourceUrl?.trim().startsWith('http')
        ? row.latestSourceUrl.trim()
        : meta?.offerUrl?.trim().startsWith('http')
          ? meta.offerUrl.trim()
          : meta?.auditSourceUrl?.trim().startsWith('http')
            ? meta.auditSourceUrl.trim()
            : null
  const saving = row?.latestSavingGbp ?? row?.latestVerifiedGbp ?? meta?.savingAmountGbp ?? meta?.verifiedSaving ?? 0
  const headline =
    row?.agentHeadline?.trim() ||
    (row?.architectProse?.trim() ? row.architectProse.trim().slice(0, 120) : '') ||
    `Updated ${journeyId.replace(/-/g, ' ')} insight`
  const base = getNextMorphCard(journeyId, {
    postcode: profile?.postcode,
    homeType: profile?.homeType ?? null,
    transport: profile?.transport ?? null,
  })
  return {
    ...base,
    title: headline,
    data: {
      ...base.data,
      money: saving > 0 ? `£${Math.round(saving)}` : base.data.money,
    },
    actions: {
      actionType: base.actions?.actionType ?? 'learn',
      learnUrl: offerUrl ?? base.actions?.learnUrl ?? '',
      ...(offerUrl ? { actionUrl: offerUrl } : base.actions?.actionUrl ? { actionUrl: base.actions.actionUrl } : {}),
    },
    high_impact: saving >= 500,
  }
}

/** Scoped Tier 2 refresh after a child-card answer (mother/child swap). */
export async function fetchTier2ScrapeSync(params: {
  postcode: string
  category: string
  answer: string
  questionId?: string | null
  userId?: string | null
}): Promise<Tier2ScrapeSyncResult> {
  const pc = params.postcode.replace(/\s+/g, '').trim().toUpperCase()
  const category = String(params.category ?? '').trim().toLowerCase()
  const answer = String(params.answer ?? '').trim()
  const empty: Tier2ScrapeSyncResult = {
    ok: false,
    category,
    coverage: null,
    meta: null,
    morphCard: null,
    offerUrl: null,
  }
  if (pc.length < 4 || !category || !answer) return empty

  const qs = new URLSearchParams({ postcode: pc, category, answer })
  const qid = String(params.questionId ?? '').trim()
  if (qid) qs.set('question_id', qid)
  const uid = params.userId ?? readBrowserResearchUserId()
  if (uid && isValidUuid(uid)) qs.set('user_id', uid)

  try {
    const res = await fetch(appendResearchUserIdQuery(`/api/scrape-sync?${qs.toString()}`), {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!res.ok) return empty
    const data = await res.json()
    const coverage = parseCoverageFromApi(data)
    const meta = parseResearchMetaFromApi(data)
    const journeyKey = (researchCategoryToJourneyKey(category) ?? category) as JourneyId
    const morphCard = buildTier2MorphCard(journeyKey, coverage, meta)
    const offerUrl =
      morphCard.actions?.actionUrl?.trim().startsWith('http')
        ? morphCard.actions.actionUrl.trim()
        : morphCard.actions?.learnUrl?.trim().startsWith('http')
          ? morphCard.actions.learnUrl.trim()
          : null
    return {
      ok: Boolean((data as { tier2?: boolean }).tier2) || res.ok,
      category,
      coverage,
      meta,
      morphCard,
      offerUrl,
    }
  } catch {
    return empty
  }
}

/** Tier 2 — persist answer locally, scoped scrape-sync, refresh Zone/Summary totals. */
export async function runTier2MotherChildSwap(params: {
  postcode: string
  category: string
  answer: string
  questionId: string
}): Promise<Tier2ScrapeSyncResult> {
  persistTier2AnswerLocal({
    journeyId: params.category,
    questionId: params.questionId,
    answer: params.answer,
  })
  const result = await fetchTier2ScrapeSync({
    postcode: params.postcode,
    category: params.category,
    answer: params.answer,
    questionId: params.questionId,
  })
  if (result.ok) {
    await refreshZoneTotalsAfterTier2(params.postcode)
  }
  return result
}
