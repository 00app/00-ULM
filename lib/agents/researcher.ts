/**
 * Supplemental ZeroResearch — **Firecrawl + Gemini + Neon** only (no external research gateway).
 * Parses scraped markdown with Gemini → unit rates → `research_results`.
 */

import type { ResearchCitation, ResearchProfileData, ZeroResearchResult } from '@/lib/agents/researchAgent'
import {
  fetchLiveEnergyData,
  fetchUkEconomicSeedMarkdown,
  OFGEM_LIVE_PRICE_CAP_URL,
} from '@/lib/agents/scraper'
import { APRIL_2026_TRUTH_PENCE, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'

function normalizeGbpPerKwh(n: unknown): number | null {
  if (typeof n !== 'number' || Number.isNaN(n)) return null
  let v = n
  if (v > 2) v /= 100
  if (v < 0.02 || v > 1.2) return null
  return Math.round(v * 10000) / 10000
}

function parseUnitRatesFromRegex(markdown: string): {
  electricityGbpPerKwh: number | null
  gasGbpPerKwh: number | null
} {
  const text = markdown.replace(/\s+/g, ' ')
  const elecCandidates = [
    /electricity[^.\d]{0,40}(\d{1,2}(?:\.\d{1,3})?)\s*p\/?\s*kwh/i,
    /electric[^.\d]{0,40}(\d{1,2}(?:\.\d{1,3})?)\s*p\/?\s*kwh/i,
  ]
  const gasCandidates = [/gas[^.\d]{0,40}(\d{1,2}(?:\.\d{1,3})?)\s*p\/?\s*kwh/i]
  const pick = (patterns: RegExp[]): number | null => {
    for (const re of patterns) {
      const m = text.match(re)
      const v = Number(m?.[1] ?? NaN)
      if (Number.isFinite(v)) return normalizeGbpPerKwh(v / 100)
    }
    return null
  }
  return {
    electricityGbpPerKwh: pick(elecCandidates),
    gasGbpPerKwh: pick(gasCandidates),
  }
}

function isWeakResearchMarkdown(markdown: string): boolean {
  const t = markdown.toLowerCase()
  if (t.length < 220) return true
  const weakMarkers = [
    "sorry, we can't seem to find that content",
    "sorry, we couldn’t find that page",
    "that content isn't available",
    'no scraped content available',
  ]
  return weakMarkers.some((m) => t.includes(m))
}

/**
 * Extract April 2026 (or stated cap) electricity / gas unit rates in £/kWh from research markdown.
 */
export async function parseApril2026UnitRatesFromMarkdown(markdown: string): Promise<{
  electricityGbpPerKwh: number | null
  gasGbpPerKwh: number | null
}> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key || markdown.length < 80) {
    return { electricityGbpPerKwh: null, gasGbpPerKwh: null }
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    })
    const prompt = `You extract UK household energy **unit rates** from the markdown below.
Return **only** valid JSON, no markdown fences: {"electricity_gbp_per_kwh": number or null, "gas_gbp_per_kwh": number or null}
Rules:
- Values must be **GBP per kWh** (e.g. 0.2467). If the text gives **pence per kWh**, divide by 100.
- If a rate is missing or ambiguous, use null.
- Prefer **April 2026** or the **current default tariff / price cap** period stated in the text.

TEXT:
${markdown.slice(0, 12_000)}`

    const text = (await model.generateContent(prompt)).response.text().trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { electricityGbpPerKwh: null, gasGbpPerKwh: null }
    const parsed = JSON.parse(match[0]) as {
      electricity_gbp_per_kwh?: unknown
      gas_gbp_per_kwh?: unknown
    }
    const llm = {
      electricityGbpPerKwh: normalizeGbpPerKwh(parsed.electricity_gbp_per_kwh as number),
      gasGbpPerKwh: normalizeGbpPerKwh(parsed.gas_gbp_per_kwh as number),
    }
    const regex = parseUnitRatesFromRegex(markdown)
    return {
      electricityGbpPerKwh: llm.electricityGbpPerKwh ?? regex.electricityGbpPerKwh,
      gasGbpPerKwh: llm.gasGbpPerKwh ?? regex.gasGbpPerKwh,
    }
  } catch {
    return parseUnitRatesFromRegex(markdown)
  }
}

function citationForOfgem(snippet: string): ResearchCitation[] {
  const url = PRICE_CAP_SOURCE_URL
  return [
    {
      source_name: 'Ofgem',
      url,
      snippet: snippet.slice(0, 400),
      title: 'Energy price cap',
    },
  ]
}

async function fetchDuckDuckGoFallbackMarkdown(query: string): Promise<{
  markdown: string
  citations: ResearchCitation[]
} | null> {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'zero-zero-research-fallback/1.0',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3500)
    if (text.length < 80) return null
    return {
      markdown: `## DuckDuckGo fallback research\n\n${text}`,
      citations: [
        {
          source_name: 'DuckDuckGo',
          url,
          snippet: text.slice(0, 320),
          title: 'DuckDuckGo search fallback',
        },
      ],
    }
  } catch {
    return null
  }
}

/**
 * Gather UK energy markdown via Firecrawl-backed fetch + DuckDuckGo fallbacks, then persist to Neon when requested.
 */
export async function triggerSupplementalResearch(params: {
  postcode?: string | null
  region?: string | null
  profileData?: ResearchProfileData | null
  persistToNeon?: boolean
  userId?: string | null
  category?: string | null
}): Promise<ZeroResearchResult | null> {
  let markdown = ''
  let citations: ResearchCitation[] = []

  if (markdown.length < 200 && process.env.FIRECRAWL_API_KEY?.trim()) {
    const fallbackMd = await fetchLiveEnergyData()
    if (fallbackMd.length > markdown.length) {
      markdown = fallbackMd
      citations = citationForOfgem(fallbackMd)
    }
  }
  if (markdown.length < 200 && !process.env.FIRECRAWL_API_KEY?.trim()) {
    const ddg = await fetchDuckDuckGoFallbackMarkdown(
      `UK energy price cap ${params.postcode ?? ''} Ofgem April 2026`
    )
    if (ddg && ddg.markdown.length > markdown.length) {
      markdown = ddg.markdown
      citations = ddg.citations
    }
  }

  if (markdown.length < 40) return null

  if (isWeakResearchMarkdown(markdown)) {
    const ddg = await fetchDuckDuckGoFallbackMarkdown(
      `Ofgem electricity p/kWh gas p/kWh April 2026 default tariff UK`
    )
    if (ddg && ddg.markdown.length > markdown.length) {
      markdown = ddg.markdown
      citations = ddg.citations
    }
  }

  if (process.env.FIRECRAWL_API_KEY?.trim()) {
    const seeds = await fetchUkEconomicSeedMarkdown()
    if (seeds.length > 120) {
      markdown = `${markdown.trim()}\n\n---\n\n## UK economic seeds\n\n${seeds}`
    }
  }

  if (citations.length === 0) {
    citations = citationForOfgem(markdown)
  }

  const result: ZeroResearchResult = { markdown, citations }

  if (params.persistToNeon) {
    let parsed = await parseApril2026UnitRatesFromMarkdown(markdown)
    if (parsed.electricityGbpPerKwh == null || parsed.gasGbpPerKwh == null) {
      const ddgRates = await fetchDuckDuckGoFallbackMarkdown(
        `UK Ofgem default tariff unit rates electricity gas p/kWh`
      )
      if (ddgRates?.markdown) {
        const reparsed = await parseApril2026UnitRatesFromMarkdown(
          `${markdown}\n\n---\n\n${ddgRates.markdown}`
        )
        parsed = {
          electricityGbpPerKwh: reparsed.electricityGbpPerKwh ?? parsed.electricityGbpPerKwh,
          gasGbpPerKwh: reparsed.gasGbpPerKwh ?? parsed.gasGbpPerKwh,
        }
      }
    }
    const degraded =
      parsed.electricityGbpPerKwh == null || parsed.gasGbpPerKwh == null || isWeakResearchMarkdown(markdown)
    const persistedElec = parsed.electricityGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH / 100
    const persistedGas = parsed.gasGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.GAS_PER_KWH / 100
    const { persistResearchResult } = await import('@/lib/agents/researchAgent')
    await persistResearchResult({
      userId: params.userId,
      postcode: params.postcode,
      profileData: params.profileData,
      markdown,
      citations,
      category: params.category ?? null,
      elecUnitRateGbpPerKwh: persistedElec,
      gasUnitRateGbpPerKwh: persistedGas,
      sourceUrl: PRICE_CAP_SOURCE_URL,
      providerName: degraded ? 'Ofgem (degraded fallback)' : 'Ofgem',
      invokePayload: {
        trigger: 'Location',
        markdownChars: markdown.length,
        citationCount: citations.length,
        degraded,
        parsedRates: parsed,
        persistedRates: {
          electricityGbpPerKwh: persistedElec,
          gasGbpPerKwh: persistedGas,
        },
      },
    })
  }

  return result
}
