import type { NeonJourneyResearchRow } from '@/lib/zone/buildZoneViewModel'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import type { JourneyId } from '@/lib/journeys'

export function coverageRowToNeon(row: ResearchCategoryCoverageRow): NeonJourneyResearchRow | null {
  const sav =
    row.latestSavingGbp != null && row.latestSavingGbp > 0
      ? row.latestSavingGbp
      : row.latestVerifiedGbp != null && row.latestVerifiedGbp > 0
        ? row.latestVerifiedGbp
        : 0
  const ap = row.architectProse?.trim() ?? null
  const hl = row.agentHeadline?.trim() ?? null
  if (sav > 0 || (ap != null && ap.length > 0) || (hl != null && hl.length > 0)) {
    return { savingGbp: sav, architectProse: ap, agentHeadline: hl }
  }
  return null
}

/** Prefer stronger £ signal; tie-break on longer architect prose. */
export function mergeNeonJourneyResearch(
  a: NeonJourneyResearchRow | undefined,
  b: NeonJourneyResearchRow | undefined
): NeonJourneyResearchRow | undefined {
  if (!a) return b
  if (!b) return a
  if (b.savingGbp > a.savingGbp) return b
  if (b.savingGbp < a.savingGbp) return a
  const al = a.architectProse?.length ?? 0
  const bl = b.architectProse?.length ?? 0
  return bl > al ? b : a
}

/**
 * Fold `grants` / `bills` Neon categories onto the nine-card Zone (`home` / `money` display buckets).
 * Core journey keys are already mapped in the caller.
 */
export function foldExtendedResearchCoverage(
  base: Partial<Record<JourneyId, NeonJourneyResearchRow>>,
  cov: Record<string, ResearchCategoryCoverageRow>
): Partial<Record<JourneyId, NeonJourneyResearchRow>> {
  const out: Partial<Record<JourneyId, NeonJourneyResearchRow>> = { ...base }
  const grants = cov.grants ? coverageRowToNeon(cov.grants) : null
  if (grants) {
    out.home = mergeNeonJourneyResearch(out.home, grants)
  }
  const bills = cov.bills ? coverageRowToNeon(cov.bills) : null
  if (bills) {
    out.money = mergeNeonJourneyResearch(out.money, bills)
  }
  return out
}
