/**
 * ZeroHunter skill — Firecrawl + Gemini → verified grant / scheme hints (2026 UK).
 */

import { firecrawl } from '@/lib/tools/firecrawl'
import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'
import { MARCH_2026_ECONOMY } from '@/lib/brains/constants'
import { formatCarbon } from '@/lib/format'
import { estimateDiscoveryCarbonKg } from '@/lib/brains/calculations'

function carbonLabelForTopic(topic: string): string {
  if (/heat|pump|boiler|bus/i.test(topic)) {
    return formatCarbon(estimateDiscoveryCarbonKg('home', 'energy_type', 'GAS'))
  }
  return formatCarbon(estimateDiscoveryCarbonKg('home', 'energy_type', 'ELECTRIC'))
}

const BUS_URL = 'https://www.gov.uk/apply-boiler-upgrade-scheme'
const OFGEM_CAP_URL = 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'

export interface ResearchLocalGrantsParsed {
  title: string
  valueMoneyStr: string
  carbonStr: string
  source_url: string
  description: string
}

function isAllowedCitationHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (h.endsWith('.gov.uk') || h.endsWith('.org.uk')) return true
    const dno = [
      'nationalgrid.com',
      'ukpowernetworks.co.uk',
      'scottishpower.co.uk',
      'northernpowergrid.com',
      'electricitynorthwest.co.uk',
      'ssen.co.uk',
      'spenergynetworks.co.uk',
    ]
    return dno.some((d) => h === d || h.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/**
 * Scrape trusted UK pages for `topic`, optionally grounded by `postcode` in the LLM prompt only.
 */
export async function researchLocalGrantsToDiscovery(
  postcode: string,
  topic: string
): Promise<ResearchLocalGrantsParsed> {
  const seedUrl = /heat|pump|boiler|bus/i.test(topic) ? BUS_URL : OFGEM_CAP_URL
  const scraped = await firecrawl.scrapeUrl(seedUrl)
  const md = sanitizeAgentMarkdown(scraped?.markdown ?? '', 8000)
  const fallback: ResearchLocalGrantsParsed = {
    title: 'HEAT PUMP GRANT',
    valueMoneyStr: `£${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()}`,
    carbonStr: carbonLabelForTopic(topic),
    source_url: BUS_URL,
    description: sanitizeAgentMarkdown(
      `postcode ${postcode || 'unknown'}: boiler upgrade scheme offers up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()} toward a heat pump — verify on gov.uk (firecrawl ${md ? 'ok' : 'pending'}).`,
      400
    ),
  }

  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key || !md) return fallback

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })
    const prompt = `UK March 2026. User postcode (context only): "${postcode}". Topic: "${topic}".

Scraped page (may be partial):
---
${md.slice(0, 6000)}
---

Return ONE JSON object only:
{ "title": "SCREAMING SHORT HEADLINE MAX 6 WORDS", "value_money": "string like £7,500 or £500", "source_url": "https from scrape — must be .gov.uk or .org.uk only", "description": "one lowercase factual sentence" }

If you cannot cite a URL from the scrape text, use exactly "${seedUrl}" for source_url.`

    const raw = (await model.generateContent(prompt)).response.text().trim()
    const o = JSON.parse(raw) as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 72).toUpperCase() : fallback.title
    const value_money =
      typeof o.value_money === 'string' && o.value_money.trim() ? o.value_money.trim() : fallback.valueMoneyStr
    let source_url =
      typeof o.source_url === 'string' && o.source_url.startsWith('https://')
        ? o.source_url.trim()
        : seedUrl
    if (!isAllowedCitationHost(source_url)) source_url = seedUrl
    const description = sanitizeAgentMarkdown(
      typeof o.description === 'string' ? o.description : fallback.description,
      400
    )
    return {
      title,
      valueMoneyStr: value_money,
      carbonStr: carbonLabelForTopic(topic),
      source_url,
      description,
    }
  } catch {
    return fallback
  }
}
