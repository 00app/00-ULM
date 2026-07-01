/**
 * Live UK energy pages via Firecrawl (markdown-only for LLM / citations).
 */

import Firecrawl from '@mendable/firecrawl-js'
import { resolveFirecrawlApiKey } from '@/lib/sentinel/api-config'
import { shouldSkipFirecrawlScrape } from '@/lib/intelligence/scrapeBoundaries'

/** Ofgem: check if energy price cap is rising or falling (households). */
export const OFGEM_LIVE_PRICE_CAP_URL =
  'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/check-if-energy-price-cap-rising-or-falling'

/** v1.8.14 OrbaLogic seeds — BBC Energy topic + UK pump-price index (Content Architect / research context). */
export const BBC_ENERGY_NEWS_TOPIC_URL = 'https://www.bbc.co.uk/news/topics/cwlw3xz0xxvt/energy'
export const PETROL_PRICES_UK_URL = 'https://www.petrolprices.com/'

const MIN_MARKDOWN_CHARS = 500
const BOT_BLOCK_RETRY_WAIT_MS = 3000

/** Production / local: `FIRE_CRAWL_KEY_3` → `FIRE_CRAWL_KEY_2` → `FIRECRAWL_API_KEY`. */
export function getFirecrawlApiKey(): string {
  return resolveFirecrawlApiKey()
}

export function hasFirecrawlApiKey(): boolean {
  return getFirecrawlApiKey().length > 0
}

function getClient(): Firecrawl | null {
  const apiKey = getFirecrawlApiKey()
  if (!apiKey) return null
  return new Firecrawl({ apiKey })
}

function extractMarkdown(res: unknown): string {
  if (typeof res !== 'object' || res === null) return ''
  const r = res as { success?: boolean; markdown?: string }
  if (r.success !== true || typeof r.markdown !== 'string') return ''
  return r.markdown.trim()
}

/**
 * Scrape the live Ofgem price-cap page; returns **markdown only** (no HTML).
 * If the first response is shorter than 500 characters, logs a Bot Block warning and retries with `waitFor: 3000`.
 */
export async function fetchLiveEnergyData(): Promise<string> {
  const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
  const client = shouldSkipFirecrawlScrape() ? null : getClient()

  if (!client) {
    const rows = await fetchMarkdownForUrlsFreeFirst([OFGEM_LIVE_PRICE_CAP_URL], { minChars: MIN_MARKDOWN_CHARS })
    return rows[0]?.markdown ?? ''
  }

  const baseParams = {
    formats: ['markdown'] as ('markdown')[],
    onlyMainContent: true,
  }

  try {
    let res = await client.scrapeUrl(OFGEM_LIVE_PRICE_CAP_URL, baseParams)
    let md = extractMarkdown(res)

    if (md.length < MIN_MARKDOWN_CHARS) {
      console.warn(
        `[scraper] Ofgem markdown only ${md.length} chars (< ${MIN_MARKDOWN_CHARS}); retrying with waitFor=${BOT_BLOCK_RETRY_WAIT_MS}ms`
      )
      res = await client.scrapeUrl(OFGEM_LIVE_PRICE_CAP_URL, {
        ...baseParams,
        waitFor: BOT_BLOCK_RETRY_WAIT_MS,
      })
      md = extractMarkdown(res)
    }

    return md
  } catch (err) {
    console.warn('[scraper] Ofgem Firecrawl scrape failed:', err)
    return ''
  }
}

/**
 * Firecrawl markdown from BBC Energy + PetrolPrices (UK). Concatenates for supplemental research / architect.
 */
export async function fetchUkEconomicSeedMarkdown(): Promise<string> {
  const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
  const client = shouldSkipFirecrawlScrape() ? null : getClient()
  const seedUrls = [BBC_ENERGY_NEWS_TOPIC_URL, PETROL_PRICES_UK_URL]

  if (!client) {
    const rows = await fetchMarkdownForUrlsFreeFirst(seedUrls, { minChars: 80 })
    return rows.map((r) => `### Source: ${r.url}\n\n${r.markdown}`).join('\n\n---\n\n')
  }

  const baseParams = {
    formats: ['markdown'] as ('markdown')[],
    onlyMainContent: true,
  }

  const chunks: string[] = []
  for (const url of [BBC_ENERGY_NEWS_TOPIC_URL, PETROL_PRICES_UK_URL]) {
    try {
      const res = await client.scrapeUrl(url, baseParams)
      const md = extractMarkdown(res)
      if (md.length >= 80) {
        chunks.push(`### Source: ${url}\n\n${md}`)
      }
    } catch {
      /* ignore single-source failure */
    }
  }

  return chunks.join('\n\n---\n\n')
}

/**
 * Free-first bridge for arbitrary trusted research URLs.
 * Uses plain fetch + Readability for static/SSR pages (gov.uk, Ofgem, MSE, EST…).
 * Falls back to Firecrawl only for JS-heavy pages that the free path can't reach.
 * When FIRECRAWL_API_KEY is absent or credits are exhausted, free path is the only path.
 */
export async function fetchFirecrawlMarkdownForUrls(
  urls: string[],
  params?: { minChars?: number; maxUrls?: number }
): Promise<Array<{ url: string; markdown: string; title?: string }>> {
  const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
  const minChars = params?.minChars ?? 120
  const maxUrls = params?.maxUrls ?? urls.length

  const firecrawlFallback = shouldSkipFirecrawlScrape() ? undefined : async (missedUrls: string[]) => {
    const client = getClient()
    if (!client) return []
    const baseParams = { formats: ['markdown'] as ('markdown')[], onlyMainContent: true }
    const out: Array<{ url: string; markdown: string; title?: string }> = []
    for (const url of missedUrls) {
      try {
        let res = await client.scrapeUrl(url, baseParams)
        let md = extractMarkdown(res)
        if (md.length < minChars) {
          res = await client.scrapeUrl(url, { ...baseParams, waitFor: BOT_BLOCK_RETRY_WAIT_MS })
          md = extractMarkdown(res)
        }
        if (md.length >= minChars) {
          const meta = res as { metadata?: { title?: unknown } }
          const title = typeof meta.metadata?.title === 'string' ? meta.metadata.title : undefined
          out.push({ url, markdown: md, title })
        }
      } catch { /* ignore */ }
    }
    return out
  }

  return fetchMarkdownForUrlsFreeFirst(urls, { minChars, maxUrls, fallback: firecrawlFallback })
}
