import type { NeonJourneyResearchRow } from '@/lib/zone/buildZoneViewModel'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import {
  cleanZonePreviewHeadline,
  headlineFromArchitectProse,
  isLowQualityZoneHeadline,
} from '@/lib/soloFocusCopy'

function mergeCoverageRow(
  a: ResearchCategoryCoverageRow | undefined,
  b: ResearchCategoryCoverageRow
): ResearchCategoryCoverageRow {
  if (!a) return { ...b }
  const moneyA = Math.max(a.latestSavingGbp ?? 0, a.latestVerifiedGbp ?? 0)
  const moneyB = Math.max(b.latestSavingGbp ?? 0, b.latestVerifiedGbp ?? 0)
  if (moneyB > moneyA) return { ...b }
  if (moneyA > moneyB) return { ...a }
  const proseA = a.architectProse?.length ?? 0
  const proseB = b.architectProse?.length ?? 0
  if (proseB > proseA) return { ...b }
  return { ...a }
}

export function coverageRowToNeon(row: ResearchCategoryCoverageRow): NeonJourneyResearchRow | null {
  const sav =
    row.latestSavingGbp != null && row.latestSavingGbp > 0
      ? row.latestSavingGbp
      : row.latestVerifiedGbp != null && row.latestVerifiedGbp > 0
        ? row.latestVerifiedGbp
        : 0
  const ap = row.architectProse?.trim() ?? null
  let hl = row.agentHeadline?.trim() ?? null
  if (hl) {
    const cleaned = cleanZonePreviewHeadline(hl)
    if (!cleaned || isLowQualityZoneHeadline(cleaned)) hl = null
    else hl = cleaned
  }
  if (!hl && ap) {
    hl = headlineFromArchitectProse(ap) ?? null
  }
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
  const aHl = a.agentHeadline?.trim() ?? ''
  const bHl = b.agentHeadline?.trim() ?? ''
  const aGood = aHl.length > 0 && !isLowQualityZoneHeadline(aHl)
  const bGood = bHl.length > 0 && !isLowQualityZoneHeadline(bHl)
  if (bGood && !aGood) return b
  if (aGood && !bGood) return a
  const al = a.architectProse?.length ?? 0
  const bl = b.architectProse?.length ?? 0
  return bl > al ? b : a
}

/**
 * Fold `grants` / `bills` Neon categories onto the nine-card Zone (`home` / `money` display buckets).
 * Core journey keys are already mapped in the caller.
 */
/** Map Neon `general` / `grants` / `bills` rows onto Zone bento journey keys. */
export function foldCoverageRowsForZone(
  cov: Record<string, ResearchCategoryCoverageRow>
): Record<string, ResearchCategoryCoverageRow> {
  const out: Record<string, ResearchCategoryCoverageRow> = { ...cov }
  const fold = (from: string, to: JourneyId) => {
    const src = cov[from]
    if (!src) return
    out[to] = mergeCoverageRow(out[to], src)
  }
  fold('grants', 'home')
  fold('bills', 'money')
  fold('general', 'home')
  return out
}

export function researchCategoryToJourneyKey(cat: string): JourneyId | null {
  const c = cat.trim().toLowerCase()
  if ((JOURNEY_ORDER as readonly string[]).includes(c)) return c as JourneyId
  if (c === 'grants') return 'home'
  if (c === 'bills') return 'money'
  if (c === 'general') return 'home'
  return null
}

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
