import type { ResearchProfileData } from '@/lib/agents/researchAgent'

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
  /** Latest row prose for this category (What / Why / How). */
  architectProse?: string | null
}

/**
 * Fire-and-forget POST /api/scrape-sync (trigger mode) for a single journey category
 * after Solo Focus answers — Hermes / ZeroResearch persists `research_results` scoped by category.
 */
export function triggerScrapeSyncForCategory(params: {
  postcode: string | null | undefined
  category: string
  profileData?: ResearchProfileData | null
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
  void fetch('/api/scrape-sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trigger: true,
      postcode: pc,
      category: cat,
      profileData: params.profileData && Object.keys(params.profileData).length > 0 ? params.profileData : undefined,
    }),
  }).catch(() => {
    /* non-blocking */
  })
}
