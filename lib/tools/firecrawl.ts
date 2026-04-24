/**
 * Firecrawl bridge — deep-scrape HTTPS URLs (JS-heavy GOV.UK, councils).
 * Uses the same API key as ZeroResearch (`FIRECRAWL_API_KEY`).
 */

import { scrapeWithFirecrawlUrl } from '@/lib/agents/researchAgent'

export const firecrawl = {
  scrapeUrl: scrapeWithFirecrawlUrl,
}
