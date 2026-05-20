import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import {
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'

/** JIT model — no background bootstrap journeys; research fires on card open (+1 answer). */
const BOOTSTRAP_JOURNEYS: JourneyId[] = []

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
  if (BOOTSTRAP_JOURNEYS.length === 0) return false
  const min = params.minSettled ?? 4
  const settled = countSettledJourneys(params.coverage)
  const hasMoney =
    (params.savingAmountGbp ?? 0) > 0 || (params.verifiedSaving ?? 0) > 0
  return settled < min && !hasMoney
}

/** Fire-and-forget POST scrape-sync triggers for core journeys (disabled under JIT). */
export function bootstrapZoneCategoryResearch(_params: {
  postcode: string
  profileData?: ResearchProfileData | null
  lifestyleShift?: boolean
}): void {
  /* Earned research only — see Tip +1 in SoloFocusOverlay. */
}
