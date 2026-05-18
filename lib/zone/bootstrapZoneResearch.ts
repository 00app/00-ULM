import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import {
  journeyResearchSettled,
  triggerScrapeSyncForCategory,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'

const BOOTSTRAP_JOURNEYS: JourneyId[] = ['home', 'grants', 'travel', 'food']

export function countSettledJourneys(
  cov: Record<string, ResearchCategoryCoverageRow> | null | undefined
): number {
  if (!cov) return 0
  return JOURNEY_ORDER.filter((jid) => journeyResearchSettled(cov[jid])).length
}

/** True when Zone should kick off background category research (Hermes-style triggers). */
export function zoneNeedsResearchBootstrap(params: {
  coverage: Record<string, ResearchCategoryCoverageRow> | null | undefined
  savingAmountGbp?: number | null
  verifiedSaving?: number | null
  minSettled?: number
}): boolean {
  const min = params.minSettled ?? 4
  const settled = countSettledJourneys(params.coverage)
  const hasMoney =
    (params.savingAmountGbp ?? 0) > 0 || (params.verifiedSaving ?? 0) > 0
  return settled < min && !hasMoney
}

/** Fire-and-forget POST scrape-sync triggers for core journeys. */
export function bootstrapZoneCategoryResearch(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  lifestyleShift?: boolean
}): void {
  const pc = params.postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return
  BOOTSTRAP_JOURNEYS.forEach((category, i) => {
    window.setTimeout(() => {
      triggerScrapeSyncForCategory({
        postcode: pc,
        category,
        profileData: params.profileData,
        lifestyleShift: params.lifestyleShift,
      })
    }, 600 + i * 2800)
  })
}
