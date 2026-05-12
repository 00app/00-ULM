/**
 * Live UK energy pages via Firecrawl (markdown-only for LLM / citations).
 */

import Firecrawl from '@mendable/firecrawl-js'

/** Ofgem: check if energy price cap is rising or falling (households). */
export const OFGEM_LIVE_PRICE_CAP_URL =
  'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/check-if-energy-price-cap-rising-or-falling'

/** v1.8.14 OrbaLogic seeds — BBC Energy topic + UK pump-price index (Content Architect / research context). */
export const BBC_ENERGY_NEWS_TOPIC_URL = 'https://www.bbc.co.uk/news/topics/cwlw3xz0xxvt/energy'
export const PETROL_PRICES_UK_URL = 'https://www.petrolprices.com/'

const MIN_MARKDOWN_CHARS = 500
const BOT_BLOCK_RETRY_WAIT_MS = 3000

function getClient(): Firecrawl | null {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim()
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
  const client = getClient()
  if (!client) return ''

  const baseParams = {
    formats: ['markdown'] as ('markdown')[],
    onlyMainContent: true,
  }

  let res = await client.scrapeUrl(OFGEM_LIVE_PRICE_CAP_URL, baseParams)
  let md = extractMarkdown(res)

  if (md.length < MIN_MARKDOWN_CHARS) {
    console.warn(
      `[scraper] Bot Block: Ofgem markdown only ${md.length} chars (< ${MIN_MARKDOWN_CHARS}); retrying with waitFor=${BOT_BLOCK_RETRY_WAIT_MS}ms`
    )
    res = await client.scrapeUrl(OFGEM_LIVE_PRICE_CAP_URL, {
      ...baseParams,
      waitFor: BOT_BLOCK_RETRY_WAIT_MS,
    })
    md = extractMarkdown(res)
  }

  return md
}

/**
 * Firecrawl markdown from BBC Energy + PetrolPrices (UK). Concatenates for supplemental research / architect.
 */
export async function fetchUkEconomicSeedMarkdown(): Promise<string> {
  const client = getClient()
  if (!client) return ''

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
