import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import {
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'

/** Research older than this is eligible for weekly refresh (Hermes-aligned). */
export const RESEARCH_STALE_MS = 7 * 24 * 60 * 60 * 1000

export function parseScrapedAtMs(raw?: string | null): number | null {
  if (!raw?.trim()) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

export function isResearchStale(scrapedAt?: string | null, nowMs = Date.now()): boolean {
  const ms = parseScrapedAtMs(scrapedAt)
  if (ms == null) return true
  return nowMs - ms >= RESEARCH_STALE_MS
}

export function countUnsettledJourneys(
  cov: Record<string, ResearchCategoryCoverageRow> | null | undefined,
  journeys: readonly JourneyId[] = JOURNEY_ORDER
): number {
  if (!cov) return journeys.length
  return journeys.filter((jid) => !journeyResearchSettled(cov[jid], { journeyId: jid })).length
}

export function coverageNeedsMechanicalRepair(
  cov: Record<string, ResearchCategoryCoverageRow> | null | undefined
): boolean {
  const unsettled = countUnsettledJourneys(cov)
  if (unsettled >= 8) return true
  if (!cov || Object.keys(cov).length === 0) return true
  const settled = JOURNEY_ORDER.length - unsettled
  if (settled === 0) return true
  return false
}

export function scrapedPayloadIsStale(
  scraped?: Array<{ scraped_at?: string; journey_key?: string }> | null
): boolean {
  if (!scraped?.length) return true
  const now = Date.now()
  const fresh = scraped.filter((row) => !isResearchStale(row.scraped_at, now))
  return fresh.length < Math.min(3, scraped.length)
}
