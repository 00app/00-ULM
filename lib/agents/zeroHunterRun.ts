/**
 * ZeroHunter — price-cap / grant pulse for cron (uses Firecrawl when configured + Gemini extraction).
 * Internal calls must pass `GATEWAY_TOKEN` or `CRON_SECRET` when hitting the app gateway.
 */

import { FIRECRAWL_API_KEY } from '@/lib/sentinel/api-config'
import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'
import { PRICE_CAP_SOURCE_URL, TYPICAL_ANNUAL_CAP } from '@/lib/brains/constants'
import { scrapeWithFirecrawlUrl } from '@/lib/agents/researchAgent'

export interface ZeroHunterGrantHit {
  title: string
  valueGbp: number
  source_url: string
  description: string
}

const OFGEM_CAP_URL = 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'

async function scrapePriceCapContext(): Promise<string> {
  const fc = await scrapeWithFirecrawlUrl(OFGEM_CAP_URL)
  if (fc?.markdown) return sanitizeAgentMarkdown(fc.markdown, 4000)
  return sanitizeAgentMarkdown(
    `Ofgem energy price cap. Typical household cap trends and October 2026 updates. Source: ${OFGEM_CAP_URL}`,
    500
  )
}

/** Re-export-friendly scrape hook (researchAgent may not export URL scrape — add thin wrapper). */
async function fallbackMarkdown(): Promise<string> {
  return `UK Ofgem price cap, 1 October to 31 December 2026: £${TYPICAL_ANNUAL_CAP} typical dual-fuel direct debit a year. The cap rose from the previous period, so there is no cap-drop saving. ${PRICE_CAP_SOURCE_URL}`
}

export async function runZeroHunterForUserProfile(params: {
  postcode: string | null
  homeType: string | null
  heatingType: string | null
}): Promise<ZeroHunterGrantHit | null> {
  const md = FIRECRAWL_API_KEY
    ? ((await scrapePriceCapContext().catch(() => '')) || (await fallbackMarkdown()))
    : (await fallbackMarkdown())

  const key = process.env.GEMINI_API_KEY?.trim()
  // No model, no grounded figure: return nothing rather than a generic cap-drop saving.
  if (!key) return null

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })
    const prompt = `UK energy assistant. User postcode=${params.postcode ?? 'unknown'}, home_type=${params.homeType ?? 'unknown'}, heating=${params.heatingType ?? 'unknown'}.

Scraped context (sanitized):
---
${md.slice(0, 3500)}
---

Return ONE JSON object only:
{ "title": "short uppercase-style headline max 5 words", "value_gbp": number (estimated annual £ saving for this user, integer, 0 if no saving is supported by the context), "source_url": "https...", "description": "one sentence lowercase" }

value_gbp must be >= 0. Prefer gov.uk URLs.`

    const raw = (await model.generateContent(prompt)).response.text()
    const o = JSON.parse(raw.trim()) as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : 'CAP SAVING'
    const valueGbp = Math.round(Number(o.value_gbp) || 0)
    if (!(valueGbp > 0)) return null
    const source_url =
      typeof o.source_url === 'string' && o.source_url.startsWith('https://')
        ? o.source_url.slice(0, 500)
        : OFGEM_CAP_URL
    const description = sanitizeAgentMarkdown(typeof o.description === 'string' ? o.description : '', 400)
    return { title, valueGbp, source_url, description }
  } catch {
    return null
  }
}
