/**
 * Server-side API keys for Firecrawl and Gemini. Firecrawl: `FIRE_CRAWL_KEY_2` only (Vercel Production).
 */
import Firecrawl from '@mendable/firecrawl-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

/** Resolved Firecrawl key (env name is FIRE_CRAWL_KEY_2). */
export const FIRECRAWL_API_KEY = process.env.FIRE_CRAWL_KEY_2?.trim() || ''
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
