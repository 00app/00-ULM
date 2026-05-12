/**
 * ZeroHunter — price-cap / grant pulse for cron (uses Firecrawl when configured + Gemini extraction).
 * Internal calls must pass GATEWAY_TOKEN / OPENCLAW_GATEWAY_TOKEN when hitting the app gateway.
 */

import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'
import { PRICE_CAP_SAVING_APRIL_1, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'
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
    `Ofgem energy price cap. Typical household cap trends and April 2026 updates. Source: ${OFGEM_CAP_URL}`,
    500
  )
}

/** Re-export-friendly scrape hook (researchAgent may not export URL scrape — add thin wrapper). */
async function fallbackMarkdown(): Promise<string> {
  return `UK March 2026: typical household price cap saving from 1 April ~£${PRICE_CAP_SAVING_APRIL_1}/yr vs prior cap period. ${PRICE_CAP_SOURCE_URL}`
}

export async function runZeroHunterForUserProfile(params: {
  postcode: string | null
  homeType: string | null
  heatingType: string | null
}): Promise<ZeroHunterGrantHit | null> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()
  const md = firecrawlKey 
    ? ((await scrapePriceCapContext().catch(() => '')) || (await fallbackMarkdown()))
    : (await fallbackMarkdown())

  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    return {
      title: 'APRIL CAP SAVING',
      valueGbp: PRICE_CAP_SAVING_APRIL_1,
      source_url: OFGEM_CAP_URL,
      description: sanitizeAgentMarkdown(
        `Typical dual-fuel household: about £${PRICE_CAP_SAVING_APRIL_1}/yr less from 1 April when the cap drops — check Ofgem for your meter type.`,
        500
      ),
    }
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })
    const prompt = `UK energy assistant. User postcode=${params.postcode ?? 'unknown'}, home_type=${params.homeType ?? 'unknown'}, heating=${params.heatingType ?? 'unknown'}.

Scraped context (sanitized):
---
${md.slice(0, 3500)}
---

Return ONE JSON object only:
{ "title": "short uppercase-style headline max 5 words", "value_gbp": number (estimated annual £ saving for this user, integer, use ${PRICE_CAP_SAVING_APRIL_1} if only cap drop applies), "source_url": "https...", "description": "one sentence lowercase" }

value_gbp must be >= 0. Prefer gov.uk URLs.`

    const raw = (await model.generateContent(prompt)).response.text()
    const o = JSON.parse(raw.trim()) as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : 'CAP SAVING'
    const valueGbp = Math.round(Number(o.value_gbp) || PRICE_CAP_SAVING_APRIL_1)
    const source_url =
      typeof o.source_url === 'string' && o.source_url.startsWith('https://')
        ? o.source_url.slice(0, 500)
        : OFGEM_CAP_URL
    const description = sanitizeAgentMarkdown(typeof o.description === 'string' ? o.description : '', 400)
    return { title, valueGbp, source_url, description }
  } catch {
    return {
      title: 'APRIL CAP SAVING',
      valueGbp: PRICE_CAP_SAVING_APRIL_1,
      source_url: OFGEM_CAP_URL,
      description: sanitizeAgentMarkdown(
        `about £${PRICE_CAP_SAVING_APRIL_1}/yr off typical use when the cap drops — see ofgem.`,
        400
      ),
    }
  }
}
