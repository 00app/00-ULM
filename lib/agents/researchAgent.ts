/**
 * ZeroResearch agent — Location-triggered UK 2026 data research.
 * Optional gateway at OPENCLAW_GATEWAY_URL when OPENCLAW_GATEWAY_TOKEN is set; else Firecrawl seeds.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getDbPool } from '@/lib/db'
import { OFGEM_LIVE_PRICE_CAP_URL } from '@/lib/agents/scraper'
import { parseApril2026UnitRatesFromMarkdown, triggerSupplementalResearch } from '@/lib/agents/researcher'
import { firecrawlZoneResearchV2JsonSchema } from '@/lib/schemas/firecrawlZoneResearchV2'
import { APRIL_2026_TRUTH_PENCE, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'
import { JOURNEY_IDS } from '@/lib/journeys'

export interface ResearchCitation {
  source_name: string
  url: string
  snippet?: string
  title?: string
  verified_at?: string
}

export interface ZeroResearchResult {
  markdown: string
  citations: ResearchCitation[]
}

/** Profile snapshot for USER.md context (home_type, transport_baseline, etc.). */
export interface ResearchProfileData {
  postcode?: string | null
  home_type?: string | null
  household?: string | null
  transport_baseline?: string | null
  heating?: string | null
  tenure?: string | null
  employment_status?: string | null
  [key: string]: string | null | undefined
}

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'

/**
 * UK 2026 seed URLs — grants (~40% of mix) + consumer / supplier intelligence (~60%).
 * Firecrawl scrapes these when the gateway is unavailable; Gemini refresh is
 * instructed to mirror the same source types (Which?, MSE, EST, Octopus, Consumer Reports, gov).
 */
/** UK 2026 crawl seeds — shared by ZeroResearch and {@link runHybridLiveZoneTipForAnswer}. */
export const UK_2026_SEED_URLS = [
  OFGEM_LIVE_PRICE_CAP_URL,
  'https://www.gov.uk/apply-boiler-upgrade-scheme',
  'https://www.gov.uk/energy-company-obligation',
  'https://energysavingtrust.org.uk/',
  'https://www.which.co.uk/money/saving-energy',
  'https://www.moneysavingexpert.com/utilities/',
  'https://octopus.energy/blog/',
  'https://www.consumerreports.org/money/energy/',
]

/**
 * Scrape a single URL using Firecrawl API when FIRECRAWL_API_KEY is set.
 */
export async function scrapeWithFirecrawlUrl(url: string): Promise<{ markdown?: string; title?: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { data?: { markdown?: string; metadata?: { title?: string } } }
    const d = data?.data
    return d ? { markdown: d.markdown, title: d.metadata?.title } : null
  } catch {
    return null
  }
}

/**
 * Single-page Firecrawl scrape with structured extract using `schemas/firecrawl-zone-research.v2.json`.
 * Returns LLM-filled JSON matching the Zone / economy research shape (when Firecrawl extract succeeds).
 */
export async function scrapeFirecrawlZoneResearchStructured(
  url: string
): Promise<{ extract?: unknown; markdown?: string; title?: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'extract'],
        onlyMainContent: true,
        extract: {
          schema: firecrawlZoneResearchV2JsonSchema,
        },
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      data?: {
        markdown?: string
        extract?: unknown
        json?: unknown
        metadata?: { title?: string }
      }
    }
    const d = data?.data
    if (!d) return null
    const extract = d.extract ?? d.json
    return {
      markdown: d.markdown,
      title: d.metadata?.title,
      extract: extract !== undefined ? extract : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Run ZeroResearch for a location (postcode/region). Uses Firecrawl when available;
 * otherwise can delegate to the research gateway (POST) if configured.
 * Returns clean Markdown + citations with source_name and url for expanded view.
 */
export async function runZeroResearch(params: {
  postcode?: string | null
  region?: string | null
  userContext?: string
}): Promise<ZeroResearchResult> {
  const { postcode, region, userContext } = params
  const citations: ResearchCitation[] = []
  const sections: string[] = []

  const seedUrls = [...UK_2026_SEED_URLS]
  const ucLow = (userContext ?? '').toLowerCase()
  /** Manifest targets — extra locality anchors for Littlehampton (UK) / Les Azerables (FR). */
  if (ucLow.includes('littlehampton') || ucLow.includes('bn17') || ucLow.includes('arun')) {
    seedUrls.unshift('https://www.arun.gov.uk/')
  }
  if (ucLow.includes('azerables') || ucLow.includes('creuse') || ucLow.includes('nouvelle-aquitaine')) {
    seedUrls.push('https://www.ecologie.gouv.fr/')
  }
  if (postcode) {
    sections.push(`## Location\nPostcode: ${postcode}\n`)
  }
  if (region) {
    sections.push(`Region: ${region}\n`)
  }
  if (userContext) {
    sections.push(`## User context\n${userContext}\n`)
  }

  for (const url of seedUrls) {
    const scraped = await scrapeWithFirecrawlUrl(url)
    if (scraped?.markdown) {
      const sourceName = scraped.title ?? new URL(url).hostname.replace(/^www\./, '')
      citations.push({
        source_name: sourceName,
        url,
        snippet: scraped.markdown.slice(0, 300),
        title: scraped.title,
      })
      sections.push(`### ${sourceName}\n\n${scraped.markdown.slice(0, 2000)}\n`)
    } else {
      citations.push({
        source_name: new URL(url).hostname.replace(/^www\./, ''),
        url,
      })
    }
  }

  const markdown = sections.length > 0 ? sections.join('\n---\n\n') : 'No scraped content available. Set FIRECRAWL_API_KEY for UK 2026 grant data.'
  return { markdown, citations }
}

/**
 * Intelligence loop — **Architect (Gemini)** on Vercel: raw Firecrawl markdown → structured JSON for Neon.
 * Output keys align with `research_results`: `category`, `saving_amount_gbp`, `offer_url`, `architect_prose`
 * (three paragraphs, \\n\\n separated). Carbon kg for Zone cards comes from `buildUserImpact` / scrapes, not
 * a separate `verified_saving_kg` column on this row (see `verified_saving` / impact pipeline elsewhere).
 */
const RESEARCH_TRIPLET_MODEL = 'gemini-2.5-flash-lite'
const ALLOWED_RESEARCH_CATEGORY = new Set<string>([...JOURNEY_IDS, 'general'])

function normalizeResearchCategory(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase()
  if (!s) return null
  if (ALLOWED_RESEARCH_CATEGORY.has(s)) return s
  return 'general'
}

/** GBP amount aligned with DB `numeric(10,2)` — always two decimal places max. */
function normalizeSavingAmountGbp(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v < 0) return null
  return Math.round(v * 100) / 100
}

function parseResearchTripletJson(raw: string): {
  category: string
  saving_amount_gbp: number
  offer_url: string
  architect_prose?: string
} | null {
  let t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const j = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
    const category = normalizeResearchCategory(typeof j.category === 'string' ? j.category : '')
    const saving_amount_gbp = normalizeSavingAmountGbp(j.saving_amount_gbp)
    const offer_url =
      typeof j.offer_url === 'string' && j.offer_url.trim().startsWith('http')
        ? j.offer_url.trim().slice(0, 2048)
        : ''
    if (!category || saving_amount_gbp == null || !offer_url) return null
    const ap =
      typeof j.architect_prose === 'string' && j.architect_prose.trim()
        ? j.architect_prose.trim().slice(0, 4000)
        : undefined
    return { category, saving_amount_gbp, offer_url, architect_prose: ap }
  } catch {
    return null
  }
}

async function extractResearchTripletWithGemini(
  markdown: string,
  postcode: string | null | undefined
): Promise<{ category: string; saving_amount_gbp: number; offer_url: string; architect_prose?: string } | null> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key || markdown.length < 80) return null
  const journeyList = [...JOURNEY_IDS, 'general'].join(', ')
  const pc = postcode?.trim() ? `Postcode context: ${postcode.trim()}\n\n` : ''
  const prompt = `${pc}From the UK household research markdown below, return ONLY valid JSON (no markdown code fence) with exactly these keys:
- "category": one of: ${journeyList} — the single best thematic fit for the main opportunity in the text.
- "saving_amount_gbp": non-negative number with up to two decimal places — plausible estimated annual GBP saving (use 0 if none inferable).
- "offer_url": one https URL copied verbatim from the markdown if any appear; otherwise use "${PRICE_CAP_SOURCE_URL}".
- "architect_prose": exactly THREE paragraphs of UK English, separated by two newline characters (blank line between each). Persona: **Zai** — Zero Zero's specialised auditor: direct, lowercase-first, value-first; no cheerleading. No filler openers ("did you know", "consider this", "fun fact", "here's the thing"). No bullet labels or markdown inside the prose. Mandatory structure — paragraph 1 = **THE WHAT** (one sharp local or scheme-specific discovery, punchy and concrete); paragraph 2 = **THE WHY** (cold numbers: tie savings to £/yr and CO₂e for a typical household using evidence from the text); paragraph 3 = **THE HOW** (one crisp instruction the reader can do this week, aligned to the offer_url theme). If you output fewer or more than three paragraphs, the response is invalid — rewrite until there are exactly three. Max ~1200 characters total.

Markdown:
---
${markdown.slice(0, 28_000)}`
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: RESEARCH_TRIPLET_MODEL,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.25 },
    })
    const out = await model.generateContent(prompt)
    const text = out.response.text() ?? ''
    const parsed = parseResearchTripletJson(text)
    return parsed
  } catch {
    return null
  }
}

function researchTripletExplicitFromParams(p: {
  category?: string | null
  offerUrl?: string | null
  deepLink?: string | null
  sourceUrl?: string | null
  savingAmountGbp?: number | null
  verifiedSaving?: number | null
}): { category: string; saving_amount_gbp: number; offer_url: string } | null {
  const cat = normalizeResearchCategory(p.category)
  const url = (p.offerUrl?.trim() || p.deepLink?.trim() || p.sourceUrl?.trim() || '').slice(0, 2048)
  const sav = normalizeSavingAmountGbp(p.savingAmountGbp ?? p.verifiedSaving)
  if (!cat || !url.startsWith('http') || sav == null) return null
  return { category: cat, saving_amount_gbp: sav, offer_url: url }
}

/**
 * Persist research result to Neon (research_results table).
 * Call after runZeroResearch or triggerSupplementalResearch to store for returning users.
 */
export async function persistResearchResult(params: {
  /** When set, ties this research row to the logged-in user (Zone / cron / Hermes). */
  userId?: string | null
  postcode?: string | null
  profileData?: ResearchProfileData | null
  markdown: string
  citations: ResearchCitation[]
  elecUnitRateGbpPerKwh?: number | null
  gasUnitRateGbpPerKwh?: number | null
  sourceUrl?: string | null
  deepLink?: string | null
  verifiedSaving?: number | null
  /** Maps to `research_results.category` (journey id or `general`). */
  category?: string | null
  /** Maps to `research_results.saving_amount_gbp` when set (overrides inference). */
  savingAmountGbp?: number | null
  /** Maps to `research_results.offer_url` when set. */
  offerUrl?: string | null
  localityContext?: string | null
  providerName?: string | null
  agentHeadline?: string | null
  /** Short AI tip for Zone cards; maps to `research_results.architect_prose`. */
  architectProse?: string | null
  /** Stored in research_results.openclaw_raw_json (legacy column name). */
  invokePayload?: unknown
  /** When true, skips the Gemini JSON triplet extraction inside persist. */
  skipResearchGeminiExtraction?: boolean
}): Promise<void> {
  try {
    const pool = getDbPool()
    await pool.query(
      `ALTER TABLE research_results
       ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS elec_unit_rate_gbp_per_kwh DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS gas_unit_rate_gbp_per_kwh DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS source_url TEXT,
       ADD COLUMN IF NOT EXISTS deep_link TEXT,
       ADD COLUMN IF NOT EXISTS verified_saving DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS locality_context TEXT,
       ADD COLUMN IF NOT EXISTS provider_name TEXT,
       ADD COLUMN IF NOT EXISTS agent_headline TEXT,
       ADD COLUMN IF NOT EXISTS openclaw_raw_json JSONB,
       ADD COLUMN IF NOT EXISTS category TEXT,
       ADD COLUMN IF NOT EXISTS offer_url TEXT,
       ADD COLUMN IF NOT EXISTS saving_amount_gbp NUMERIC(10,2),
       ADD COLUMN IF NOT EXISTS architect_prose TEXT`
    )
    const providerName =
      params.providerName?.trim() ||
      (params.citations[0]?.source_name ? String(params.citations[0].source_name).trim() : null)
    const deepResolved = params.deepLink ?? params.sourceUrl ?? null

    const explicitTriplet = researchTripletExplicitFromParams(params)
    let geminiTriplet: {
      category: string
      saving_amount_gbp: number
      offer_url: string
      architect_prose?: string
    } | null = null
    const skipGemini =
      params.skipResearchGeminiExtraction === true || explicitTriplet != null
    if (!skipGemini) {
      geminiTriplet = await extractResearchTripletWithGemini(params.markdown, params.postcode ?? null)
    }
    const mergedCategory =
      normalizeResearchCategory(params.category) ??
      geminiTriplet?.category ??
      explicitTriplet?.category ??
      null
    const mergedSaving =
      normalizeSavingAmountGbp(params.savingAmountGbp) ??
      normalizeSavingAmountGbp(params.verifiedSaving) ??
      geminiTriplet?.saving_amount_gbp ??
      explicitTriplet?.saving_amount_gbp ??
      null
    const firstHttpCitation = params.citations.find(
      (c) => typeof c.url === 'string' && c.url.trim().startsWith('http')
    )
    const citationFallback = firstHttpCitation?.url?.trim().slice(0, 2048) || null
    const mergedOfferRaw =
      (params.offerUrl?.trim() && params.offerUrl.trim().startsWith('http')
        ? params.offerUrl.trim()
        : null) ??
      geminiTriplet?.offer_url ??
      explicitTriplet?.offer_url ??
      (deepResolved?.startsWith('http') ? deepResolved : null) ??
      citationFallback ??
      PRICE_CAP_SOURCE_URL
    const mergedOffer = mergedOfferRaw.slice(0, 2048)

    const savingForDb = mergedSaving ?? null
    const verifiedForDb = savingForDb

    const mergedArchitectProse =
      params.architectProse?.trim() ||
      geminiTriplet?.architect_prose?.trim() ||
      params.agentHeadline?.trim() ||
      null

    await pool.query(
      `INSERT INTO research_results (
         user_id, postcode, profile_snapshot, markdown, citations,
         elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
         deep_link, verified_saving, category, offer_url, saving_amount_gbp, locality_context,
         provider_name, agent_headline, architect_prose, openclaw_raw_json, created_at
       )
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14, $15, $16, $17, $18::jsonb, NOW())`,
      [
        params.userId?.trim() || null,
        params.postcode ?? null,
        JSON.stringify(params.profileData ?? {}),
        params.markdown,
        JSON.stringify(params.citations),
        params.elecUnitRateGbpPerKwh ?? null,
        params.gasUnitRateGbpPerKwh ?? null,
        params.sourceUrl ?? null,
        deepResolved,
        verifiedForDb,
        mergedCategory,
        mergedOffer,
        savingForDb,
        params.localityContext ?? null,
        providerName,
        params.agentHeadline?.trim() ?? null,
        mergedArchitectProse,
        params.invokePayload !== undefined ? JSON.stringify(params.invokePayload) : null,
      ]
    )
  } catch (e) {
    console.warn('[researchAgent] persistResearchResult failed:', e)
  }
}

export { triggerSupplementalResearch }

/**
 * Run ZeroResearch for a location (postcode + optional profileData). Tries gateway first;
 * falls back to local Firecrawl. Persists to Neon when persistToNeon is true.
 */
export async function runZeroResearchWithProfile(params: {
  postcode?: string | null
  region?: string | null
  profileData?: ResearchProfileData | null
  userContext?: string
  persistToNeon?: boolean
  userId?: string | null
}): Promise<ZeroResearchResult> {
  const gatewayResult = await triggerSupplementalResearch({
    postcode: params.postcode,
    region: params.region,
    profileData: params.profileData,
    persistToNeon: params.persistToNeon,
    userId: params.userId,
  })
  if (gatewayResult) return gatewayResult

  const userContext = params.userContext ?? (params.profileData
    ? `postcode: ${params.postcode ?? '—'}, home_type: ${params.profileData.home_type ?? '—'}, transport: ${params.profileData.transport_baseline ?? '—'}`
    : undefined)
  const result = await runZeroResearch({
    postcode: params.postcode,
    region: params.region,
    userContext,
  })
  if (params.persistToNeon && (result.markdown || result.citations.length > 0)) {
    const parsed = await parseApril2026UnitRatesFromMarkdown(result.markdown)
    const degraded = parsed.electricityGbpPerKwh == null || parsed.gasGbpPerKwh == null
    await persistResearchResult({
      userId: params.userId,
      postcode: params.postcode,
      profileData: params.profileData,
      markdown: result.markdown,
      citations: result.citations,
      elecUnitRateGbpPerKwh:
        parsed.electricityGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH / 100,
      gasUnitRateGbpPerKwh: parsed.gasGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.GAS_PER_KWH / 100,
      sourceUrl: PRICE_CAP_SOURCE_URL,
      providerName: degraded ? 'Ofgem (degraded fallback)' : undefined,
      invokePayload: {
        trigger: 'Location',
        fallbackPath: 'runZeroResearchWithProfile',
        degraded,
      },
    })
  }
  return result
}
