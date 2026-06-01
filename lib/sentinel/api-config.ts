/**
 * Server-side API keys for Firecrawl and Gemini.
 * Firecrawl: `FIRE_CRAWL_KEY_3` → `FIRE_CRAWL_KEY_2` → legacy `FIRECRAWL_API_KEY`.
 */
import Firecrawl from '@mendable/firecrawl-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export function resolveFirecrawlApiKey(): string {
  return (
    process.env.FIRE_CRAWL_KEY_3?.trim() ||
    process.env.FIRE_CRAWL_KEY_2?.trim() ||
    process.env.FIRECRAWL_API_KEY?.trim() ||
    ''
  )
}

/** Which env var supplied the Firecrawl key (Flight Deck label only — never the secret). */
export function resolveFirecrawlEnvSlot():
  | 'FIRE_CRAWL_KEY_3'
  | 'FIRE_CRAWL_KEY_2'
  | 'FIRECRAWL_API_KEY'
  | null {
  if (process.env.FIRE_CRAWL_KEY_3?.trim()) return 'FIRE_CRAWL_KEY_3'
  if (process.env.FIRE_CRAWL_KEY_2?.trim()) return 'FIRE_CRAWL_KEY_2'
  if (process.env.FIRECRAWL_API_KEY?.trim()) return 'FIRECRAWL_API_KEY'
  return null
}

/** Resolved Firecrawl key for scrapers and Sentinel. */
export const FIRECRAWL_API_KEY = resolveFirecrawlApiKey()
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() ?? ''

export function getFirecrawlClient(): Firecrawl | null {
  if (!FIRECRAWL_API_KEY) return null
  return new Firecrawl({ apiKey: FIRECRAWL_API_KEY })
}

export function getGeminiClient(): GoogleGenerativeAI | null {
  if (!GEMINI_API_KEY) return null
  return new GoogleGenerativeAI(GEMINI_API_KEY)
}

export function hasLiveGroundingKeys(): boolean {
  return Boolean(FIRECRAWL_API_KEY && GEMINI_API_KEY)
}
