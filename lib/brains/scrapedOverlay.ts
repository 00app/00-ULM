/**
 * S UPDATE — Scraped data overlay for UserImpact
 *
 * Validates scraped values against calculated baseline (≤20% delta).
 * Blends scraped data into impact results and provides insight labels
 * for the Bento .deep-content and Intelligence Tags.
 */

import type { JourneyId } from '@/lib/journeys'
import type { ImpactResult } from './calculations'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'

const MAX_DELTA_RATIO = 0.2

export interface ScrapedOverlayResult extends ImpactResult {
  /** When present, show in .deep-content / scraped-insight-tag */
  insightLabel?: string
  /** When true, card gets 1px solid var(--color-blue) "Insight Alert" */
  insightAlert?: boolean
  /** If values were updated from scraper (for counting animation) */
  fromScraper?: boolean
  /** S Update: local grant amount (e.g. £12,000) — weighted into moneyGbp for final impact score */
  localGrantGbp?: number
}

/**
 * Check if a scraped value is within 20% of the calculated baseline.
 * Returns the value to use (scraped if valid, else baseline).
 */
function withinDelta(baseline: number, scraped: number): number {
  if (baseline === 0) return scraped >= 0 ? scraped : 0
  const ratio = scraped / baseline
  if (ratio >= 1 - MAX_DELTA_RATIO && ratio <= 1 + MAX_DELTA_RATIO) {
    return Math.round(scraped)
  }
  return baseline
}

/**
 * Apply scraped data to a single journey impact result.
 * Validates carbon and money against baseline; if within 20%, use scraped.
 * Attaches insightLabel and insightAlert for UI.
 */
export function applyScrapedOverlay(
  base: ImpactResult,
  scraped: ScrapedDataPoint | undefined,
  _journeyKey: JourneyId
): ScrapedOverlayResult {
  if (!scraped) {
    return { ...base }
  }

  const carbon = withinDelta(base.carbonKg, scraped.carbon_value)
  const baseMoney = withinDelta(base.moneyGbp, scraped.money_value)
  const localGrantGbp = scraped.local_grant_gbp ?? 0
  const money = baseMoney + localGrantGbp
  const fromScraper = carbon !== base.carbonKg || baseMoney !== base.moneyGbp || localGrantGbp > 0

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: base.source,
    explanation: scraped.deep_content_tip
      ? [scraped.deep_content_tip, ...base.explanation]
      : base.explanation,
    insightLabel: scraped.deep_content_tip ?? undefined,
    insightAlert: Boolean(scraped.high_saving),
    fromScraper,
    localGrantGbp: localGrantGbp > 0 ? localGrantGbp : undefined,
  }
}
