import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'

export type NeonJourneyResearchRow = {
  savingGbp?: number
  architectProse?: string | null
  agentHeadline?: string | null
}

/** True when Neon scrape-sync or research_results supplied this journey. */
export function journeyHasStreamData(
  journeyKey: JourneyId,
  opts: {
    neonJourneyResearch?: Partial<Record<JourneyId, NeonJourneyResearchRow>>
    scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
  }
): boolean {
  const neon = opts.neonJourneyResearch?.[journeyKey]
  if (neon?.savingGbp != null && Number.isFinite(neon.savingGbp) && neon.savingGbp > 0) {
    return true
  }
  if (typeof neon?.architectProse === 'string' && neon.architectProse.trim().length > 0) {
    return true
  }
  if (typeof neon?.agentHeadline === 'string' && neon.agentHeadline.trim().length > 0) {
    return true
  }
  const sc = opts.scraped?.[journeyKey]
  if (sc && Number(sc.money_value) > 0) return true
  if (sc?.deep_content_tip?.trim()) return true
  return false
}

export function hasAnyStreamData(opts: {
  neonJourneyResearch?: Partial<Record<JourneyId, NeonJourneyResearchRow>>
  scraped?: Partial<Record<JourneyId, ScrapedDataPoint>>
}): boolean {
  return JOURNEY_ORDER.some((jid) => journeyHasStreamData(jid, opts))
}

export function computingJourneyTitle(journeyKey: JourneyId): string {
  return `COMPUTING — ${journeyKey.replace(/-/g, ' ').toUpperCase()}`
}
