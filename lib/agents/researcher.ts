/**
 * Supplemental ZeroResearch via gateway WebSocket (primary) + HTTP fallback.
 * Parses scraped markdown with Gemini → unit rates → Neon (`research_results`).
 */

import WebSocket from 'ws'
import { zeroResearchInvokeExtras } from '@/lib/agents/config'
import {
  fetchLiveEnergyData,
  fetchUkEconomicSeedMarkdown,
  OFGEM_LIVE_PRICE_CAP_URL,
} from '@/lib/agents/scraper'
import { APRIL_2026_TRUTH_PENCE, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'
import type { ResearchCitation, ResearchProfileData, ZeroResearchResult } from '@/lib/agents/researchAgent'

const GATEWAY_HTTP = (process.env.OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789').replace(/\/$/, '')
const GATEWAY_WS =
  process.env.OPENCLAW_GATEWAY_WS_URL?.trim() ||
  GATEWAY_HTTP.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://')

const WS_GATHER_MS = 90_000

function buildInvokePayload(params: {
  postcode?: string | null
  region?: string | null
  profileData?: ResearchProfileData | null
}) {
  const employment =
    params.profileData?.employment_status != null
      ? String(params.profileData.employment_status).trim()
      : undefined
  return {
    agent: 'ZeroResearch',
    trigger: 'Location',
    params: {
      postcode: params.postcode,
      region: params.region,
      employment_status: employment && employment.length > 0 ? employment : undefined,
      profileData: params.profileData ?? undefined,
      scrapeTargetUrl: OFGEM_LIVE_PRICE_CAP_URL,
      instruction:
        'Use the Firecrawl tool to scrape scrapeTargetUrl and return the page as markdown. Include any stated default tariff unit rates (electricity and gas) for the current price-cap period. For broader UK economic context (motor fuel, energy headlines), also consider BBC News UK energy coverage and PetrolPrices.com UK averages when reasoning for downstream Content Architect cards.',
    },
    ...zeroResearchInvokeExtras(),
  }
}

function accumulateMarkdownFromMessage(buf: string, raw: string): string {
  let out = buf
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>
    if (typeof msg.markdown === 'string') out += msg.markdown
    if (msg.type === 'event' && typeof msg.payload === 'string') out += msg.payload
    const data = msg.data as { markdown?: string } | undefined
    if (data && typeof data.markdown === 'string') out += data.markdown
    if (msg.type === 'result' && typeof msg.text === 'string') out += msg.text
  } catch {
    if (raw.trim().length > 0 && !raw.trim().startsWith('{')) out += raw
  }
  return out
}

/** Collect streamed markdown from the research gateway WebSocket. */
export function gatherResearchMarkdownViaWebSocket(body: Record<string, unknown>): Promise<string> {
  const token = process.env.OPENCLAW_API_KEY?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  if (!token) return Promise.resolve('')

  return new Promise((resolve) => {
    let markdown = ''
    let settled = false
    const done = (final: string) => {
      if (settled) return
      settled = true
      resolve(final.trim())
    }

    const ws = new WebSocket(GATEWAY_WS)
    const authPayload = JSON.stringify({ type: 'auth', token })

    const sendAuth = () => {
      if (ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(authPayload)
      } catch {
        /* ignore */
      }
    }

    const timer = setTimeout(() => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      done(markdown)
    }, WS_GATHER_MS)

    ws.on('open', () => {
      sendAuth()
      queueMicrotask(sendAuth)
      setTimeout(sendAuth, 120)
      setTimeout(() => {
        try {
          ws.send(JSON.stringify({ type: 'invoke', ...body }))
        } catch {
          /* ignore */
        }
      }, 160)
    })

    ws.on('message', (data) => {
      markdown = accumulateMarkdownFromMessage(markdown, data.toString())
    })

    ws.on('close', () => {
      clearTimeout(timer)
      done(markdown)
    })

    ws.on('error', () => {
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      done(markdown)
    })
  })
}

async function invokeGatewayHttp(body: Record<string, unknown>): Promise<ZeroResearchResult | null> {
  const token = process.env.OPENCLAW_API_KEY?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  if (!token) return null
  try {
    const res = await fetch(`${GATEWAY_HTTP}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { markdown?: string; citations?: ResearchCitation[] }
    return {
      markdown: data.markdown ?? '',
      citations: Array.isArray(data.citations) ? data.citations : [],
    }
  } catch {
    return null
  }
}

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
  const gasCandidates = [
    /gas[^.\d]{0,40}(\d{1,2}(?:\.\d{1,3})?)\s*p\/?\s*kwh/i,
  ]
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
 * WebSocket to research gateway, then HTTP `/tools/invoke` if WS yields little text.
 * With `persistToNeon`, runs Gemini parse and writes `research_results` (unit rates + `source_url`).
 */
export async function triggerSupplementalResearch(params: {
  postcode?: string | null
  region?: string | null
  profileData?: ResearchProfileData | null
  persistToNeon?: boolean
}): Promise<ZeroResearchResult | null> {
  const body = buildInvokePayload(params) as Record<string, unknown>

  let markdown = await gatherResearchMarkdownViaWebSocket(body)
  let citations: ResearchCitation[] = []

  if (markdown.length < 400) {
    const httpResult = await invokeGatewayHttp(body)
    if (httpResult && httpResult.markdown.length >= markdown.length) {
      markdown = httpResult.markdown
      citations = httpResult.citations
    }
  }

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
      markdown = `${markdown.trim()}\n\n---\n\n## UK economic seeds (BBC Energy, PetrolPrices — v1.8.14)\n\n${seeds}`
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
    // Never persist null rates; lock to April 2026 truth when scrape quality is degraded.
    const persistedElec = parsed.electricityGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH / 100
    const persistedGas = parsed.gasGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.GAS_PER_KWH / 100
    const { persistResearchResult } = await import('@/lib/agents/researchAgent')
    await persistResearchResult({
      postcode: params.postcode,
      profileData: params.profileData,
      markdown,
      citations,
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
