import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { type JourneyId } from '@/lib/journeys'
import {
  journeyResearchSettled,
  triggerScrapeSyncForCategory,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import { getDevBootstrapJourneys } from '@/lib/zone/devResearchBootstrap'

const BOOTSTRAP_STAGGER_MS = 2_500

export function countSettledJourneys(
  cov: Record<string, ResearchCategoryCoverageRow> | null | undefined,
  journeys?: JourneyId[]
): number {
  if (!cov) return 0
  const list = journeys ?? getDevBootstrapJourneys()
  if (list.length === 0) return 0
  return list.filter((jid) => journeyResearchSettled(cov[jid], { journeyId: jid })).length
}

/** True when localhost dev should kick off background category research. */
export function zoneNeedsResearchBootstrap(params: {
  coverage: Record<string, ResearchCategoryCoverageRow> | null | undefined
  savingAmountGbp?: number | null
  verifiedSaving?: number | null
}): boolean {
  const journeys = getDevBootstrapJourneys()
  if (journeys.length === 0) return false
  const unsettled = journeys.filter(
    (jid) => !journeyResearchSettled(params.coverage?.[jid], { journeyId: jid })
  )
  if (unsettled.length === 0) return false
  const hasMoney =
    (params.savingAmountGbp ?? 0) > 0 || (params.verifiedSaving ?? 0) > 0
  if (hasMoney && unsettled.length <= 2) return false
  return true
}

/** Fire-and-forget POST scrape-sync triggers for unsettled dev-bootstrap journeys. */
export function bootstrapZoneCategoryResearch(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  lifestyleShift?: boolean
  coverage?: Record<string, ResearchCategoryCoverageRow> | null
}): void {
  if (typeof window === 'undefined') return
  const journeys = getDevBootstrapJourneys()
  if (journeys.length === 0) return
  const pc = String(params.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) return

  const cov = params.coverage
  let delay = 0
  for (const jid of journeys) {
    if (cov && journeyResearchSettled(cov[jid], { journeyId: jid })) continue
    const run = () => {
      triggerScrapeSyncForCategory({
        postcode: pc,
        category: jid,
        profileData: params.profileData,
        lifestyleShift: params.lifestyleShift,
      })
    }
    if (delay === 0) run()
    else window.setTimeout(run, delay)
    delay += BOOTSTRAP_STAGGER_MS
  }
}
