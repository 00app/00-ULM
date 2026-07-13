/**
 * §Phase 4 — Hybrid agent bridge: Firecrawl raw fetch + Gemini structural map → ZoneTipCard.
 * Ground-truth pages first; Gemini only formats into the injection schema (no “search”).
 */

import type { JourneyId } from '@/lib/journeys'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { validateInjectionCard } from '@/lib/zone/injections'
import { buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { researchLocalGrantsToDiscovery } from '@/lib/agents/skills/researchLocalGrants'
import { scrapeWithFirecrawlUrl, UK_2026_SEED_URLS } from '@/lib/agents/researchAgent'
import { HYBRID_LIVE_ATTRIBUTION } from '@/lib/agents/hybridLiveAttribution'

export { UK_2026_SEED_URLS, HYBRID_LIVE_ATTRIBUTION }

export type HybridLiveZoneTipResult = {
  card: ZoneTipCard
  researchAttribution: { headline: string | null; supplied_by: string | null }
  scrapedUrl: string
  source_url: string
  verified_date: string
}

/**
 * Pick the best single URL to scrape for this answer (Tier-1 muscle target).
 */
export function resolveHybridPrimaryScrapeUrl(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode?: string | null
  profileData?: { home_type?: string | null; transport_baseline?: string | null } | null
}): string | null {
  const { journeyId, questionId, answerValue, postcode, profileData } = params
  const normalizedPostcode = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  const homeType = (profileData?.home_type ?? '').toUpperCase()
  const fuel = answerValue.trim().toUpperCase()
  if (journeyId === 'home' && questionId === 'energy_type' && answerValue.trim().toUpperCase() === 'GAS') {
    if (normalizedPostcode.startsWith('KW') && fuel === 'GAS' && homeType.length > 0) {
      return 'https://www.homeenergyscotland.org/funding-grants/heat-pump-grants-loans/'
    }
    return 'https://www.gov.uk/apply-boiler-upgrade-scheme'
  }
  return null
}

/**
 * Fetch markdown for one URL (Firecrawl). No Gemini — for diagnostics / future multi-page merges.
 */
export async function fetchLiveMarkdownForUrl(url: string): Promise<{ markdown: string; title?: string } | null> {
  const scraped = await scrapeWithFirecrawlUrl(url)
  if (!scraped?.markdown?.trim()) return null
  return { markdown: scraped.markdown, title: scraped.title }
}

/**
 * Tier-1 only: scrape the first N UK 2026 seeds (sequential; keep N small for latency).
 */
export async function scrapeUk2026SeedMarkdowns(params?: {
  maxUrls?: number
}): Promise<Array<{ url: string; markdown: string; title?: string }>> {
  const maxUrls = Math.min(Math.max(1, params?.maxUrls ?? 3), UK_2026_SEED_URLS.length)
  const out: Array<{ url: string; markdown: string; title?: string }> = []
  for (let i = 0; i < maxUrls; i++) {
    const url = UK_2026_SEED_URLS[i]!
    const scraped = await scrapeWithFirecrawlUrl(url)
    if (scraped?.markdown?.trim()) {
      out.push({ url, markdown: scraped.markdown, title: scraped.title })
    }
  }
  return out
}

/**
 * Run the hybrid pipeline for answers we support today (home + gas → BUS).
 * Reuses {@link researchLocalGrantsToDiscovery} (Firecrawl markdown + Gemini JSON extract).
 */
export async function runHybridLiveZoneTipForAnswer(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null
  profileData?: { home_type?: string | null; transport_baseline?: string | null } | null
}): Promise<HybridLiveZoneTipResult | null> {
  const { journeyId, questionId, answerValue, postcode, profileData } = params
  const target = resolveHybridPrimaryScrapeUrl({ journeyId, questionId, answerValue, postcode, profileData })
  if (!target) return null

  const legacyGasSpawn =
    journeyId === 'home' && questionId === 'energy_type' && answerValue.trim().toUpperCase() === 'GAS'
  if (!legacyGasSpawn) {
    return null
  }

  const pc = postcode?.replace(/\s+/g, '').trim() ?? ''
  const parsed = await researchLocalGrantsToDiscovery(pc, 'Heat Pump Grant')
  const rec = getDiscoveryRecommendation('home', 'energy_type', 'GAS')
  const id = `${buildDiscoveryInjectionId(journeyId, questionId, answerValue)}-hybrid-live`

  const zoneCard = validateInjectionCard({
    id,
    title: parsed.title,
    journey_key: 'home',
    category: 'home',
    data: { money: parsed.valueMoneyStr, carbon: parsed.carbonStr },
    source: parsed.source_url,
    explanation: [parsed.description],
    actions: {
      actionType: 'learn',
      learnUrl: parsed.source_url,
      actionUrl: parsed.source_url,
    },
    cta: { label: 'Check eligibility', url: parsed.source_url },
    ...(rec.followUp ? { followUp: rec.followUp } : {}),
  })
  if (!zoneCard) return null

  return {
    card: zoneCard,
    researchAttribution: {
      headline: parsed.title,
      supplied_by: HYBRID_LIVE_ATTRIBUTION,
    },
    scrapedUrl: parsed.source_url || target,
    verified_date: 'April 2026' as const,
    source_url: parsed.source_url || target,
  }
}
