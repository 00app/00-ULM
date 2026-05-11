/**
 * ZeroResearch agent — Location-triggered UK 2026 data research.
 * Optional gateway at OPENCLAW_GATEWAY_URL when OPENCLAW_GATEWAY_TOKEN is set; else Firecrawl seeds.
 */

import { getDbPool } from '@/lib/db'
import { OFGEM_LIVE_PRICE_CAP_URL } from '@/lib/agents/scraper'
import { parseApril2026UnitRatesFromMarkdown, triggerSupplementalResearch } from '@/lib/agents/researcher'
import { firecrawlZoneResearchV2JsonSchema } from '@/lib/schemas/firecrawlZoneResearchV2'
import { APRIL_2026_TRUTH_PENCE, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'

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
  localityContext?: string | null
  providerName?: string | null
  agentHeadline?: string | null
  /** Stored in research_results.openclaw_raw_json (legacy column name). */
  invokePayload?: unknown
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
       ADD COLUMN IF NOT EXISTS offer_url TEXT,
       ADD COLUMN IF NOT EXISTS saving_amount_gbp DOUBLE PRECISION`
    )
    const providerName =
      params.providerName?.trim() ||
      (params.citations[0]?.source_name ? String(params.citations[0].source_name).trim() : null)
    const deepResolved = params.deepLink ?? params.sourceUrl ?? null
    const offerResolved = deepResolved
    const savingResolved = params.verifiedSaving ?? null
    await pool.query(
      `INSERT INTO research_results (
         user_id, postcode, profile_snapshot, markdown, citations,
         elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
         deep_link, verified_saving, offer_url, saving_amount_gbp, locality_context,
         provider_name, agent_headline, openclaw_raw_json, created_at
       )
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, NOW())`,
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
        params.verifiedSaving ?? null,
        offerResolved,
        savingResolved,
        params.localityContext ?? null,
        providerName,
        params.agentHeadline?.trim() ?? null,
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
