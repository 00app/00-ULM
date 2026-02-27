/**
 * S UPDATE — 9-Journey Data Source Matrix (2026 UK Focus)
 *
 * The "001 Scraper" targets these high-authority UK sources.
 * Scraped data is sanitized, validated (≤20% delta), and injected
 * into the UserImpact engine via lib/brains/scrapedOverlay.
 */

import type { JourneyId } from '@/lib/journeys'

export interface ScraperSourceConfig {
  journey: JourneyId
  primaryTarget: string
  carbonMetric: string
  moneyMetric: string
  /** Optional: label for actionable insight in .deep-content */
  insightLabel?: string
}

/** UK regulatory and industrial sources per journey (001 Scraper map) */
export const SCRAPER_SOURCE_MATRIX: Record<JourneyId, ScraperSourceConfig> = {
  home: {
    journey: 'home',
    primaryTarget: 'Ofgem & Energy Saving Trust',
    carbonMetric: 'current unit rates gas/elec; heat pump subsidy status',
    moneyMetric: 'unit rates £/kWh',
    insightLabel: 'Current UK unit rates and heat pump grants',
  },
  travel: {
    journey: 'travel',
    primaryTarget: 'DFT & Zap-Map',
    carbonMetric: 'PBT cost-per-mile; Tube vs Bus intensity',
    moneyMetric: 'petrol £/L vs public charger p/kWh',
    insightLabel: 'Switching to rail today saves £X and Ykg vs driving',
  },
  food: {
    journey: 'food',
    primaryTarget: 'WRAP (Love Food Hate Waste)',
    carbonMetric: 'seasonal crop intensity',
    moneyMetric: 'average food waste cost £/household/yr',
    insightLabel: 'UK household food waste cost and carbon',
  },
  shopping: {
    journey: 'shopping',
    primaryTarget: 'Ellen MacArthur Foundation',
    carbonMetric: 'carbon cost of Ultra-Fast Fashion returns',
    moneyMetric: 'circular economy savings',
    insightLabel: 'Circular economy savings and returns impact',
  },
  money: {
    journey: 'money',
    primaryTarget: 'Make My Money Matter',
    carbonMetric: 'carbon intensity green vs standard funds',
    moneyMetric: 'pension/banking fund carbon intensity',
    insightLabel: 'Green pension vs standard fund intensity',
  },
  carbon: {
    journey: 'carbon',
    primaryTarget: 'National Grid ESO',
    carbonMetric: 'real-time grid carbon intensity g/kWh',
    moneyMetric: '—',
    insightLabel: 'Live UK grid intensity for calculation adjustments',
  },
  tech: {
    journey: 'tech',
    primaryTarget: 'Back Market & Restart Project',
    carbonMetric: 'e-waste impact',
    moneyMetric: 'repair vs replacement savings',
    insightLabel: 'Repair over replacement impact',
  },
  waste: {
    journey: 'waste',
    primaryTarget: 'DEFRA Statistics',
    carbonMetric: 'landfill methane impact',
    moneyMetric: 'local authority recycling efficiency',
    insightLabel: 'Local recycling rates and landfill impact',
  },
  holidays: {
    journey: 'holidays',
    primaryTarget: 'Eurostar & Skyscanner',
    carbonMetric: 'flight vs rail emission parity UK–Europe',
    moneyMetric: 'route cost and carbon comparison',
    insightLabel: 'Flight vs rail for popular UK–Europe routes',
  },
}

export interface ScrapedDataPoint {
  journey_key: JourneyId
  /** Scraped at (ISO); used for freshness */
  scraped_at: string
  /** Carbon value from scraper (e.g. kg CO₂e/yr or g/kWh) */
  carbon_value: number
  /** Money value from scraper (e.g. £/yr) */
  money_value: number
  /** Optional actionable tip for .deep-content */
  deep_content_tip?: string
  /** If true, treat as "High Saving" and show insight alert border */
  high_saving?: boolean
  /** S Update: council-specific grant (e.g. £12,000 Solar, Warm Homes). Added to money in impact score. */
  local_grant_gbp?: number
}
