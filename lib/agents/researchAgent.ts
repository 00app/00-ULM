/**
 * ZeroResearch agent — Location-triggered UK 2026 data research (Firecrawl seeds + Gemini).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateResearchText, RESEARCH_GATEWAY_MODEL_CHAIN } from '@/lib/intelligence/aiGateway'
import { isDeepLinkedUkOfferUrl } from '@/lib/zone/urlShield'
import {
  normalizeCategoryToJourneyKey,
  trustedUrlForJourney,
} from '@/lib/zone/trustedJourneyUrls'
import { getDbPool } from '@/lib/db'
import { getFirecrawlApiKey, OFGEM_LIVE_PRICE_CAP_URL } from '@/lib/agents/scraper'
import {
  isWeakResearchMarkdown,
  parseApril2026UnitRatesFromMarkdown,
  triggerSupplementalResearch,
} from '@/lib/agents/researcher'
import { getLocalData } from '@/lib/local/getLocalData'
import { firecrawlZoneResearchV2JsonSchema } from '@/lib/schemas/firecrawlZoneResearchV2'
import { APRIL_2026_TRUTH_PENCE, PRICE_CAP_SOURCE_URL } from '@/lib/brains/constants'
import { JOURNEY_IDS } from '@/lib/journeys'
import { GRANTS_AND_BILLS_CATEGORY_PROTOCOL, isAllowedResearchCategory } from '@/lib/intelligence/researchCategories'
import {
  headlineFromTitle,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
  stripExpandedCardTitleNoise,
} from '@/lib/soloFocusCopy'

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
  error?: string
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

export type DynamicResearchProfileRow = {
  postcode?: string | null
  home_type?: string | null
  household?: string | null
  transport_baseline?: string | null
  name?: string | null
  age_group?: string | null
  employment_status?: string | null
  user_genome?: Record<string, unknown> | null
  goal?: string | null
}

function readStringProfileField(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const raw = row[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

function readObjectProfileField(row: Record<string, unknown> | null | undefined, keys: string[]): Record<string, unknown> | null {
  if (!row) return null
  for (const key of keys) {
    const raw = row[key]
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  }
  return null
}

function normalizeDynamicResearchProfile(
  usersRow: Record<string, unknown> | null,
  profileRow: Record<string, unknown> | null
): DynamicResearchProfileRow | null {
  if (!usersRow && !profileRow) return null
  const genomeFromUsers = readObjectProfileField(usersRow, ['user_genome', 'genome'])
  const genomeFromProfile = readObjectProfileField(profileRow, ['user_genome', 'genome', 'profile_genome'])
  const userGenome =
    genomeFromUsers || genomeFromProfile
      ? { ...(genomeFromUsers ?? {}), ...(genomeFromProfile ?? {}) }
      : null

  return {
    postcode:
      readStringProfileField(profileRow, ['postcode', 'profile_postcode', 'postal_code']) ??
      readStringProfileField(usersRow, ['postcode', 'profile_postcode', 'postal_code']),
    home_type:
      readStringProfileField(profileRow, ['home_type', 'homeType', 'property_type']) ??
      readStringProfileField(usersRow, ['home_type', 'homeType', 'property_type']),
    household:
      readStringProfileField(profileRow, ['household', 'living_situation', 'livingSituation']) ??
      readStringProfileField(usersRow, ['household', 'living_situation', 'livingSituation']),
    transport_baseline:
      readStringProfileField(profileRow, ['transport_baseline', 'transport', 'primary_transport']) ??
      readStringProfileField(usersRow, ['transport_baseline', 'transport', 'primary_transport']),
    name:
      readStringProfileField(profileRow, ['name', 'first_name', 'display_name']) ??
      readStringProfileField(usersRow, ['name', 'first_name', 'display_name']),
    age_group:
      readStringProfileField(profileRow, ['age_group', 'ageGroup', 'age']) ??
      readStringProfileField(usersRow, ['age_group', 'ageGroup', 'age']),
    employment_status:
      readStringProfileField(profileRow, ['employment_status', 'employmentStatus']) ??
      readStringProfileField(usersRow, ['employment_status', 'employmentStatus']),
    goal:
      readStringProfileField(profileRow, ['goal', 'profile_goal']) ??
      readStringProfileField(usersRow, ['goal', 'profile_goal']),
    user_genome: userGenome,
  }
}

/**
 * Dynamic national profile resolver.
 * Prefers `public.user_profiles.postcode` when that table exists, then canonical `public.users`.
 * Never falls back to a static postcode.
 */
export async function loadDynamicUserProfileForResearch(userId: string): Promise<DynamicResearchProfileRow | null> {
  const pool = getDbPool()
  let usersRow: Record<string, unknown> | null = null
  let profileRow: Record<string, unknown> | null = null

  try {
    const users = await pool.query(
      `SELECT postcode, home_type, household, transport_baseline, name, age_group, employment_status, user_genome
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    )
    usersRow = (users.rows[0] as Record<string, unknown> | undefined) ?? null
  } catch {
    usersRow = null
  }

  try {
    const rel = await pool.query<{ exists: string | null }>(
      `SELECT to_regclass('public.user_profiles')::text AS exists`
    )
    if (rel.rows[0]?.exists) {
      const profiles = await pool.query<{ profile: Record<string, unknown> }>(
        `SELECT to_jsonb(up) AS profile
         FROM user_profiles up
         WHERE to_jsonb(up)->>'user_id' = $1 OR to_jsonb(up)->>'id' = $1
         LIMIT 1`,
        [userId]
      )
      profileRow = profiles.rows[0]?.profile ?? null
    }
  } catch {
    profileRow = null
  }

  return normalizeDynamicResearchProfile(usersRow, profileRow)
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
  const { fetchFirecrawlMarkdownForUrls } = await import('@/lib/agents/scraper')
  const rows = await fetchFirecrawlMarkdownForUrls([url], { minChars: 80, maxUrls: 1 })
  if (rows.length === 0) return null
  return { markdown: rows[0].markdown, title: rows[0].title }
}

/**
 * Single-page Firecrawl scrape with structured extract using `schemas/firecrawl-zone-research.v2.json`.
 * Returns LLM-filled JSON matching the Zone / economy research shape (when Firecrawl extract succeeds).
 */
export async function scrapeFirecrawlZoneResearchStructured(
  url: string
): Promise<{ extract?: unknown; markdown?: string; title?: string } | null> {
  const apiKey = getFirecrawlApiKey()
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
  const { region, userContext } = params
  const postcode = params.postcode?.replace(/\s+/g, '').toUpperCase() || ''
  if (!postcode) return { markdown: 'No outcode detected', citations: [], error: 'No outcode detected' }
  const citations: ResearchCitation[] = []
  const sections: string[] = []

  const seedUrls = [...UK_2026_SEED_URLS]
  const dynamicSeeds = await buildDynamicLocalitySeedUrls(postcode, userContext)
  for (const url of dynamicSeeds) {
    if (!seedUrls.includes(url)) seedUrls.unshift(url)
  }
  const localIntel = await getLocalData(postcode).catch(() => null)
  if (postcode) {
    sections.push(`## Location\nPostcode: ${postcode}\n`)
  }
  if (localIntel) {
    const localityLabel = [localIntel.locality, localIntel.council, localIntel.region]
      .filter(Boolean)
      .join(', ')
    if (localityLabel) {
      sections.push(`## Locality (Neon / Postcodes.io)\n${localityLabel}\n`)
    }
  }
  if (region) {
    sections.push(`Region: ${region}\n`)
  }
  if (userContext) {
    sections.push(`## User context\n${userContext}\n`)
  }

  const { fetchFirecrawlMarkdownForUrls } = await import('@/lib/agents/scraper')
  const batchUrls = seedUrls.slice(0, 8)
  const scrapedBatch = await fetchFirecrawlMarkdownForUrls(batchUrls, { minChars: 80, maxUrls: batchUrls.length })
  const scrapedByUrl = new Map(scrapedBatch.map((r) => [r.url, r]))
  for (const url of batchUrls) {
    const scraped = scrapedByUrl.get(url)
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

  let markdown =
    sections.length > 0
      ? sections.join('\n---\n\n')
      : 'No scraped content available. Set FIRE_CRAWL_KEY_2 for UK 2026 grant data.'
  if (isWeakResearchMarkdown(markdown) || markdown.includes('No scraped content')) {
    const localityContext = localIntel
      ? [localIntel.locality, localIntel.council, localIntel.region].filter(Boolean).join(', ')
      : null
    const deep = await deepGeminiSearchUkEnergyMarkdown({
      postcode,
      localityContext,
      profileData: undefined,
    })
    if (deep) {
      markdown = `${markdown}\n\n---\n\n${deep.markdown}`
      citations.push(...deep.citations)
    }
    if (isWeakResearchMarkdown(markdown)) {
      const { fetchLiveEnergyData } = await import('@/lib/agents/scraper')
      const ofgemMd = await fetchLiveEnergyData()
      if (ofgemMd.length > 80) {
        markdown = `${markdown}\n\n---\n\n## Ofgem live scrape\n\n${ofgemMd}`
        citations.push({
          source_name: 'Ofgem',
          url: OFGEM_LIVE_PRICE_CAP_URL,
          snippet: ofgemMd.slice(0, 320),
        })
      }
    }
  }
  return { markdown, citations }
}

/**
 * Intelligence loop — **Architect (Gemini)** on Vercel: raw Firecrawl markdown → structured JSON for Neon.
 * Output keys align with `research_results`: `category`, `saving_amount_gbp`, `offer_url`, `agent_headline` (~20 words),
 * `architect_prose` (exactly three paragraphs, \\n\\n separated, max 40 words each, no UI section labels in text). Carbon kg for Zone
 * cards comes from `buildUserImpact` / scrapes, not a separate `verified_saving_kg` column on this row (see
 * `verified_saving` / impact pipeline elsewhere).
 */
const RESEARCH_TRIPLET_MODEL = process.env.GEMINI_RESEARCH_MODEL?.trim() || 'gemini-flash-latest'
/** Recovery / backfill when triplet fields are missing — user-facing “Deep Gemini Search”. */
const RESEARCH_RECOVERY_MODEL = process.env.GEMINI_RESEARCH_RECOVERY_MODEL?.trim() || 'gemini-flash-latest'

async function buildDynamicLocalitySeedUrls(
  postcode: string,
  userContext?: string
): Promise<string[]> {
  const seeds: string[] = []
  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  if (pc.length >= 4) {
    seeds.push(`https://www.gov.uk/find-local-council/${encodeURIComponent(pc)}`)
  }
  const local = await getLocalData(postcode).catch(() => null)
  if (local?.council) {
    const councilSlug = local.council
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 32)
    if (councilSlug.length >= 4) {
      seeds.push(`https://www.gov.uk/government/organisations/${councilSlug}`)
    }
  }
  const ucLow = (userContext ?? '').toLowerCase()
  if (ucLow.includes('azerables') || ucLow.includes('creuse') || ucLow.includes('nouvelle-aquitaine')) {
    seeds.push('https://www.ecologie.gouv.fr/')
  }
  return seeds
}

function extractHttpsCitationsFromMarkdown(
  text: string,
  sourceName: string
): ResearchCitation[] {
  const seen = new Set<string>()
  const out: ResearchCitation[] = []
  for (const m of text.matchAll(/https:\/\/[^\s)\]"'<>]+/gi)) {
    const url = m[0].replace(/[.,;]+$/, '')
    if (!url.startsWith('https://') || seen.has(url)) continue
    seen.add(url)
    out.push({
      source_name: sourceName,
      url,
      snippet: text.slice(0, 280),
      title: sourceName,
    })
  }
  return out
}

/**
 * Gemini-only UK energy research when Firecrawl markdown is thin or missing a headline.
 */
export async function deepGeminiSearchUkEnergyMarkdown(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  localityContext?: string | null
  category?: string | null
  lifestyleShift?: boolean
}): Promise<{ markdown: string; citations: ResearchCitation[] } | null> {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  if (pc.length < 4) return null
  const profileBlock = buildResearchProfileAuditorContext(params.profileData ?? null)
  const locality = params.localityContext?.trim()
  const cat = normalizeResearchCategory(params.category ?? '')
  const categoryLine = cat
    ? params.lifestyleShift
      ? `Lifestyle shift / pattern arbitrage for **${cat}**: rail vs flight, EV swap, local vs long-haul holidays, meal shifts — not generic grant homepages. One concrete £/year trade-off and one deep-linked https application or booking URL.`
      : `Focus this pass on the **${cat}** journey (UK household money/carbon) with a concrete £/year figure and one https offer URL in the prose.`
    : ''
  const prompt = `You are a UK household energy research agent (April 2026 regulatory window).
Write detailed markdown for postcode **${pc}**${locality ? ` (${locality})` : ''}.
${categoryLine}
Include: current Ofgem-style default tariff unit rates (p/kWh and £/kWh where possible), council or regional grant/ECO/BUS cues, and one concrete £/year saving action with a numeric GBP amount.
Use UK English, industrial tone, no small-talk. Reference https:// sources inline where possible.
${profileBlock}
Return markdown only (no JSON, no code fences).`

  try {
    const tag = params.category?.trim().toLowerCase() || 'energy-recovery'
    const { text: raw } = await generateResearchText({
      prompt,
      tag,
      maxOutputTokens: 2048,
      temperature: 0.35,
    })
    const text = raw.trim()
    if (text.length < 80) return null
    const journeyKey = normalizeCategoryToJourneyKey(cat ?? 'home')
    const parsed = extractHttpsCitationsFromMarkdown(text, 'Gemini deep search')
    const deepCites = parsed.filter((c) => isDeepLinkedUkOfferUrl(c.url))
    const citationUrl = params.lifestyleShift
      ? trustedUrlForJourney(journeyKey)
      : PRICE_CAP_SOURCE_URL
    const citations =
      deepCites.length > 0
        ? deepCites
        : [
            {
              source_name: 'Gemini deep search',
              url: citationUrl,
              snippet: text.slice(0, 320),
              title: params.lifestyleShift ? `${cat} pattern shift` : 'UK energy recovery pass',
            },
          ]
    return {
      markdown: `## Deep Gemini search (UK energy)\n\n${text}`,
      citations,
    }
  } catch (e) {
    console.warn(
      '[researchAgent] deepGeminiSearchUkEnergyMarkdown failed:',
      e instanceof Error ? e.message : e
    )
    return null
  }
}
const ALLOWED_TRIPLET_CATEGORIES = [...JOURNEY_IDS, 'general', 'grants', 'bills'] as const

function normalizeResearchCategory(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase()
  if (!s) return null
  if (isAllowedResearchCategory(s)) return s
  return 'general'
}

/** GBP amount aligned with DB `numeric(10,2)` — always two decimal places max. */
function normalizeSavingAmountGbp(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v < 0) return null
  return Math.round(v * 100) / 100
}

const MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH = 40

function clipArchitectParagraphToMaxWords(p: string, maxWords: number): string {
  const words = p.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return p.trim()
  return words.slice(0, maxWords).join(' ')
}

/** Exactly three `\n\n`-separated paragraphs; reject mashed single-paragraph output; clip each paragraph to max words. */
function normalizeArchitectProseThreeParagraphs(ap: string | undefined): string | undefined {
  if (!ap?.trim()) return undefined
  const parts = ap
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => clipArchitectParagraphToMaxWords(p, MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH))
  if (parts.length === 3) return parts.join('\n\n')
  if (parts.length > 3) return parts.slice(0, 3).join('\n\n')
  if (parts.length === 1) {
    const sentences = parts[0].split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 8)
    if (sentences.length >= 3) {
      const third = Math.ceil(sentences.length / 3)
      const chunks = [
        sentences.slice(0, third).join(' '),
        sentences.slice(third, third * 2).join(' '),
        sentences.slice(third * 2).join(' '),
      ].map((p) => clipArchitectParagraphToMaxWords(p, MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH))
      return chunks.join('\n\n')
    }
  }
  if (parts.length === 2) {
    return [
      clipArchitectParagraphToMaxWords(parts[0], MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH),
      clipArchitectParagraphToMaxWords(parts[1], MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH),
      clipArchitectParagraphToMaxWords(parts[1], MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH),
    ].join('\n\n')
  }
  return undefined
}

/** ~20-word auditor headline for Solo Focus H1 + Neon `agent_headline`. */
function normalizeGeminiAgentHeadline(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  const cleaned = stripExpandedCardTitleNoise(raw.trim())
  const clipped = headlineFromTitle(cleaned, MAX_EXPANDED_VIEW_HEADLINE_WORDS)
  return clipped.length > 0 ? clipped.slice(0, 600) : undefined
}

/** When Gemini / gateway JSON triplet fails, recover £/URL/prose from research markdown (BN17-style audits). */
function inferResearchTripletFromMarkdown(
  markdown: string,
  categoryHint?: string | null
): {
  category: string
  saving_amount_gbp: number
  offer_url: string
  agent_headline?: string
  architect_prose?: string
} | null {
  const md = markdown.trim()
  if (md.length < 120) return null

  const savingPatterns = [
    /Annual Saving:\s*\*?\*?£\s*([\d,]+(?:\.\d+)?)\s*\/?\s*year/i,
    /\*\*£\s*([\d,]+(?:\.\d+)?)\s*\/?\s*year\*\*/i,
    /£\s*([\d,]+(?:\.\d+)?)\s*\/?\s*year/i,
    /save\s+£\s*([\d,]+(?:\.\d+)?)/i,
  ]
  let saving: number | null = null
  for (const re of savingPatterns) {
    const m = md.match(re)
    if (!m?.[1]) continue
    const n = normalizeSavingAmountGbp(m[1].replace(/,/g, ''))
    if (n != null && n > 0) {
      saving = n
      break
    }
  }
  if (saving == null) return null

  const urlMatch = md.match(/https:\/\/[^\s)\]"']+/i)
  const offer_url = urlMatch?.[0]?.trim().slice(0, 2048) ?? ''

  const deepSection = md.split(/## Deep Gemini search/i)[1]?.trim() ?? md
  const paragraphs = deepSection
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s*/, '').trim())
    .filter((p) => p.length > 40 && !p.startsWith('---'))
  const architect_prose = normalizeArchitectProseThreeParagraphs(
    paragraphs.length >= 3
      ? paragraphs.slice(0, 3).join('\n\n')
      : paragraphs.length > 0
        ? paragraphs.join('\n\n')
        : deepSection.slice(0, 1200)
  )

  const headlineSource =
    paragraphs.find((p) => /£\s*[\d,]+/i.test(p)) ??
    paragraphs[0] ??
    `Regional audit — £${Math.round(saving)} per year`
  const agent_headline = normalizeGeminiAgentHeadline(headlineSource.slice(0, 320))

  const category = normalizeResearchCategory(categoryHint) ?? 'home'
  return {
    category,
    saving_amount_gbp: saving,
    offer_url,
    agent_headline,
    architect_prose,
  }
}

function parseResearchTripletJson(raw: string): {
  category: string
  saving_amount_gbp: number
  offer_url: string
  agent_headline?: string
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
    if (!category || saving_amount_gbp == null) return null
    const apRaw =
      typeof j.architect_prose === 'string' && j.architect_prose.trim()
        ? j.architect_prose.trim().slice(0, 4000)
        : undefined
    const architect_prose = normalizeArchitectProseThreeParagraphs(apRaw)
    const agent_headline = normalizeGeminiAgentHeadline(
      typeof j.agent_headline === 'string' ? j.agent_headline : undefined
    )
    return { category, saving_amount_gbp, offer_url, agent_headline, architect_prose }
  } catch {
    return null
  }
}

function buildResearchProfileAuditorContext(data: ResearchProfileData | null | undefined): string {
  if (!data || typeof data !== 'object') return ''
  const rows: string[] = []
  for (const [key, raw] of Object.entries(data)) {
    if (raw == null) continue
    const s = String(raw).trim()
    if (!s) continue
    rows.push(`- ${key}: ${s.length > 280 ? `${s.slice(0, 280)}…` : s}`)
    if (rows.length >= 24) break
  }
  if (!rows.length) return ''
  return `Household auditing context (treat as ground truth — interrogate the markdown through this lens, not generic “grants” SEO):\n${rows.join('\n')}\n\n`
}

function researchTripletNeedsRecovery(triplet: {
  saving_amount_gbp: number
  agent_headline?: string
  architect_prose?: string
} | null): boolean {
  if (!triplet) return true
  const saving = normalizeSavingAmountGbp(triplet.saving_amount_gbp)
  if (saving == null || saving <= 0) return true
  if (!normalizeGeminiAgentHeadline(triplet.agent_headline)) return true
  if (!normalizeArchitectProseThreeParagraphs(triplet.architect_prose)) return true
  return false
}

async function extractResearchTripletWithGemini(
  markdown: string,
  postcode: string | null | undefined,
  profileData?: ResearchProfileData | null,
  options?: { model?: string; categoryHint?: string | null }
): Promise<{
  category: string
  saving_amount_gbp: number
  offer_url: string
  agent_headline?: string
  architect_prose?: string
} | null> {
  if (markdown.length < 80) return null
  const journeyList = ALLOWED_TRIPLET_CATEGORIES.join(', ')
  const pc = postcode?.trim() ? `Postcode context: ${postcode.trim()}\n\n` : ''
  const profileBlock = buildResearchProfileAuditorContext(profileData ?? null)
  const catHint = normalizeResearchCategory(options?.categoryHint ?? '')
  const categoryBias = catHint
    ? `Target journey category for this pass (use "${catHint}" unless the evidence clearly fits another listed category): ${catHint}\n\n`
    : ''
  const prompt = `${pc}${profileBlock}${categoryBias}You are **Zai**, the **Personal Intelligence Auditor** for Zero Zero (UK household energy, money, carbon). Your job is **forensic intelligence**, not generic web search: interrogate the evidence on the user’s behalf. When the profile implies children, tenancy, food waste, or a tight locality (for example a county, council, or outcode), prefer **surgical** angles — efficiency hacks, bulk-buy collectives, engineering-grade appliance calibration, scheme eligibility — over vague “look for grants” filler. If a grant is the best instrument, keep it; if a small £/week habit change dominates the math, say so plainly.

${GRANTS_AND_BILLS_CATEGORY_PROTOCOL}

From the markdown below, return ONLY valid JSON (no markdown code fence) with exactly these keys:
- "category": one of: ${journeyList} — the single best thematic fit for the main opportunity in the text.
- "saving_amount_gbp": non-negative number with up to two decimal places — plausible estimated annual GBP saving (use 0 if none inferable).
- "offer_url": one https URL copied verbatim from the markdown or citation context. If no live URL exists, return an empty string.
- "agent_headline": one bold, specific sentence of **approximately twenty words** (hard cap: do not exceed 22 words). High-authority audit summary; concrete locality or scheme where the text supports it (e.g. outcode, programme name, £/yr figure). No section labels. No trailing colon. Normal sentence casing; lowercase where natural at the start of clauses is fine.
- "architect_prose": exactly **THREE** paragraphs of UK English, each separated by **two** newline characters (one blank line between paragraphs). Industrial, dense, zero small-talk. **Hard cap: each paragraph must be at most ${MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH} words.** **Do not** print structural headings, labels, markdown hash-headings, bullets, numbering, roman numerals, or role markers. **Banned:** lines or sentence starts like "What:", "Why:", "How:", "Paragraph 1:", "Discovery:", or any bracketed staging — the reader must infer what / why / how **only** from plain flowing prose across the three paragraphs. The trinity lives **inside** the prose only: paragraph 1 = the concrete discovery for this household/postcode/profile context; paragraph 2 = the cold math (£/yr and kg CO₂e or equivalent, tied to evidence in the text); paragraph 3 = the immediate industrial action the reader should take this week (aligned with offer_url). Mix local schemes with high-authority technical levers when the text supports both. If you output fewer or more than three paragraphs, the response is invalid — rewrite until there are exactly three. Max ~1200 characters total for architect_prose.

Markdown:
---
${markdown.slice(0, 28_000)}`
  try {
    const tag = normalizeResearchCategory(options?.categoryHint ?? '') || 'architect-triplet'
    const { text } = await generateResearchText({
      prompt,
      tag,
      maxOutputTokens: 1536,
      temperature: 0.25,
      models: options?.model?.trim()
        ? [options.model.trim(), ...RESEARCH_GATEWAY_MODEL_CHAIN]
        : undefined,
    })
    const parsed = parseResearchTripletJson(text)
    return parsed
  } catch (e) {
    console.warn(
      '[researchAgent] extractResearchTripletWithGemini failed:',
      e instanceof Error ? e.message : e
    )
    return null
  }
}

async function resolveResearchTripletWithRecovery(params: {
  markdown: string
  postcode: string | null | undefined
  profileData?: ResearchProfileData | null
  skipGemini: boolean
  categoryHint?: string | null
}): Promise<{
  markdown: string
  triplet: {
    category: string
    saving_amount_gbp: number
    offer_url: string
    agent_headline?: string
    architect_prose?: string
  } | null
  extraCitations: ResearchCitation[]
}> {
  if (params.skipGemini) {
    return { markdown: params.markdown, triplet: null, extraCitations: [] }
  }
  let markdown = params.markdown
  const extraCitations: ResearchCitation[] = []
  const extractOpts = { categoryHint: params.categoryHint ?? null }

  const alreadyHasDeepGemini = /## deep gemini search/i.test(markdown)
  if (isWeakResearchMarkdown(markdown) && !alreadyHasDeepGemini && params.postcode?.trim()) {
    const local = await getLocalData(params.postcode).catch(() => null)
    const localityContext = local
      ? [local.locality, local.council, local.region].filter(Boolean).join(', ')
      : null
    const { fetchLiveEnergyData } = await import('@/lib/agents/scraper')
    const ofgemMd = await fetchLiveEnergyData()
    if (ofgemMd.length > 80) {
      markdown = `${markdown.trim()}\n\n---\n\n## Ofgem live scrape\n\n${ofgemMd}`
      extraCitations.push({
        source_name: 'Ofgem',
        url: OFGEM_LIVE_PRICE_CAP_URL,
        snippet: ofgemMd.slice(0, 320),
      })
    }
    const deep = await deepGeminiSearchUkEnergyMarkdown({
      postcode: params.postcode,
      profileData: params.profileData ?? null,
      localityContext,
      category: params.categoryHint ?? null,
    })
    if (deep) {
      markdown = `${markdown}\n\n---\n\n${deep.markdown}`
      extraCitations.push(...deep.citations)
    }
  }

  let triplet = await extractResearchTripletWithGemini(
    markdown,
    params.postcode,
    params.profileData,
    extractOpts
  )
  if (researchTripletNeedsRecovery(triplet)) {
    triplet = await extractResearchTripletWithGemini(markdown, params.postcode, params.profileData, {
      ...extractOpts,
      model: RESEARCH_RECOVERY_MODEL,
    })
  }
  if (researchTripletNeedsRecovery(triplet) && params.postcode?.trim()) {
    const local = await getLocalData(params.postcode).catch(() => null)
    const localityContext = local
      ? [local.locality, local.council, local.region].filter(Boolean).join(', ')
      : null
    const deep = await deepGeminiSearchUkEnergyMarkdown({
      postcode: params.postcode,
      profileData: params.profileData ?? null,
      localityContext,
      category: params.categoryHint ?? null,
    })
    if (deep) {
      markdown = `${markdown}\n\n---\n\n${deep.markdown}`
      extraCitations.push(...deep.citations)
      triplet = await extractResearchTripletWithGemini(markdown, params.postcode, params.profileData, {
        ...extractOpts,
        model: RESEARCH_RECOVERY_MODEL,
      })
    }
  }
  return { markdown, triplet, extraCitations }
}

/**
 * Backfill Neon rows where `agent_headline` is null — Firecrawl + Gemini recovery.
 */
export async function repairResearchResultsMissingHeadlines(params: {
  userId?: string | null
  postcode?: string | null
  profileData?: ResearchProfileData | null
  limit?: number
}): Promise<number> {
  const pool = getDbPool()
  const limit = Math.min(Math.max(params.limit ?? 6, 1), 20)
  const pc = params.postcode?.replace(/\s+/g, '').trim() ?? ''
  const uid = params.userId?.trim() ?? ''
  type Row = {
    id: string
    markdown: string
    citations: unknown
    profile_snapshot: unknown
    postcode: string | null
    category: string | null
  }
  let rows: Row[] = []
  try {
    const incomplete = `(agent_headline IS NULL OR TRIM(agent_headline) = '')
           OR architect_prose IS NULL OR TRIM(architect_prose) = ''
           OR saving_amount_gbp IS NULL OR COALESCE(saving_amount_gbp, 0) <= 0`
    if (uid) {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category
         FROM research_results
         WHERE user_id = $1::uuid
           AND (${incomplete})
         ORDER BY created_at DESC NULLS LAST
         LIMIT $2`,
        [uid, limit]
      )
      rows = r.rows
    } else if (pc.length >= 4) {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category
         FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
           AND (${incomplete})
         ORDER BY created_at DESC NULLS LAST
         LIMIT $2`,
        [pc, limit]
      )
      rows = r.rows
    }
  } catch (e) {
    console.warn('[researchAgent] repairResearchResultsMissingHeadlines query failed:', e)
    return 0
  }

  let repaired = 0
  for (const row of rows) {
    const citations = Array.isArray(row.citations) ? (row.citations as ResearchCitation[]) : []
    const profileFromRow =
      row.profile_snapshot && typeof row.profile_snapshot === 'object' && !Array.isArray(row.profile_snapshot)
        ? (row.profile_snapshot as ResearchProfileData)
        : null
    const profileData = profileFromRow ?? params.profileData ?? null
    const pcRow = row.postcode?.replace(/\s+/g, '').trim() || params.postcode?.replace(/\s+/g, '').trim() || ''
    const { markdown, triplet, extraCitations } = await resolveResearchTripletWithRecovery({
      markdown: row.markdown ?? '',
      postcode: pcRow || null,
      profileData,
      skipGemini: false,
      categoryHint: row.category,
    })
    const headline = normalizeGeminiAgentHeadline(triplet?.agent_headline)
    const architect = normalizeArchitectProseThreeParagraphs(triplet?.architect_prose)
    const saving = normalizeSavingAmountGbp(triplet?.saving_amount_gbp)
    if (!headline && !architect && saving == null) continue
    const mergedCitations = [...extraCitations, ...citations]
    const offer =
      typeof triplet?.offer_url === 'string' && triplet.offer_url.startsWith('http')
        ? triplet.offer_url.slice(0, 2048)
        : null
    try {
      await pool.query(
        `UPDATE research_results
         SET agent_headline = $2,
             architect_prose = COALESCE($3, architect_prose),
             category = COALESCE($4, category),
             saving_amount_gbp = COALESCE($5::numeric, saving_amount_gbp),
             offer_url = COALESCE($6, offer_url),
             markdown = $7,
             citations = $8::jsonb
         WHERE id = $1::uuid`,
        [
          row.id,
          headline,
          architect ?? null,
          triplet?.category ?? null,
          saving ?? triplet?.saving_amount_gbp ?? null,
          offer,
          markdown,
          JSON.stringify(mergedCitations),
        ]
      )
      repaired += 1
    } catch (e) {
      console.warn('[researchAgent] repair row update failed:', e)
    }
  }
  return repaired
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
  /** Stored in `research_results.research_snapshot` (Hermes / QA metadata JSON). */
  invokePayload?: unknown
  /** When true, skips the Gemini JSON triplet extraction inside persist. */
  skipResearchGeminiExtraction?: boolean
  /** Action Vault rebirth — Solo Focus high-impact row. */
  isHighImpact?: boolean
  /** kg CO₂e avoided (rebirth model output). */
  carbonImpactKg?: number | null
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
       ADD COLUMN IF NOT EXISTS research_snapshot JSONB,
       ADD COLUMN IF NOT EXISTS category TEXT,
       ADD COLUMN IF NOT EXISTS offer_url TEXT,
       ADD COLUMN IF NOT EXISTS saving_amount_gbp NUMERIC(10,2),
       ADD COLUMN IF NOT EXISTS architect_prose TEXT,
       ADD COLUMN IF NOT EXISTS is_high_impact BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS carbon_impact_kg NUMERIC(12,2)`
    )
    const deepResolved = params.deepLink ?? params.sourceUrl ?? null

    const explicitTriplet = researchTripletExplicitFromParams(params)
    const skipGemini =
      params.skipResearchGeminiExtraction === true || explicitTriplet != null
    const { markdown: workingMarkdown, triplet: geminiTriplet, extraCitations } =
      await resolveResearchTripletWithRecovery({
        markdown: params.markdown,
        postcode: params.postcode ?? null,
        profileData: params.profileData ?? null,
        skipGemini,
        categoryHint: params.category ?? null,
      })
    const markdownTriplet =
      geminiTriplet ?? inferResearchTripletFromMarkdown(workingMarkdown, params.category ?? null)
    const mergedCitations = [...extraCitations, ...params.citations]
    const providerName =
      params.providerName?.trim() ||
      (mergedCitations[0]?.source_name ? String(mergedCitations[0].source_name).trim() : null)
    const mergedCategory =
      normalizeResearchCategory(params.category) ??
      markdownTriplet?.category ??
      geminiTriplet?.category ??
      explicitTriplet?.category ??
      null
    const mergedSaving =
      normalizeSavingAmountGbp(params.savingAmountGbp) ??
      normalizeSavingAmountGbp(params.verifiedSaving) ??
      markdownTriplet?.saving_amount_gbp ??
      geminiTriplet?.saving_amount_gbp ??
      explicitTriplet?.saving_amount_gbp ??
      null
    const firstHttpCitation = mergedCitations.find(
      (c) => typeof c.url === 'string' && c.url.trim().startsWith('http')
    )
    const citationFallback = firstHttpCitation?.url?.trim().slice(0, 2048) || null
    const mergedOfferRaw =
      (params.offerUrl?.trim() && params.offerUrl.trim().startsWith('http')
        ? params.offerUrl.trim()
        : null) ??
      markdownTriplet?.offer_url ??
      geminiTriplet?.offer_url ??
      explicitTriplet?.offer_url ??
      (deepResolved?.startsWith('http') ? deepResolved : null) ??
      citationFallback
    const mergedOffer = mergedOfferRaw?.slice(0, 2048) ?? null

    const explicitHttpSource =
      typeof params.sourceUrl === 'string' && params.sourceUrl.trim().startsWith('http')
        ? params.sourceUrl.trim().slice(0, 2048)
        : null
    const mergedSourceForDb =
      explicitHttpSource ??
      (citationFallback ? citationFallback.slice(0, 2048) : null) ??
      (mergedOffer?.startsWith('http') ? mergedOffer : null)

    const savingForDb = mergedSaving ?? null
    const verifiedForDb = savingForDb

    const mergedArchitectProse =
      normalizeArchitectProseThreeParagraphs(params.architectProse?.trim()) ??
      normalizeArchitectProseThreeParagraphs(markdownTriplet?.architect_prose?.trim()) ??
      normalizeArchitectProseThreeParagraphs(geminiTriplet?.architect_prose?.trim()) ??
      null

    const mergedAgentHeadline =
      normalizeGeminiAgentHeadline(params.agentHeadline ?? undefined) ??
      normalizeGeminiAgentHeadline(markdownTriplet?.agent_headline) ??
      normalizeGeminiAgentHeadline(geminiTriplet?.agent_headline) ??
      null

    const highImpact = params.isHighImpact === true
    const carbonKg =
      params.carbonImpactKg != null && Number.isFinite(params.carbonImpactKg)
        ? params.carbonImpactKg
        : null

    await pool.query(
      `INSERT INTO research_results (
         user_id, postcode, profile_snapshot, markdown, citations,
         elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
         deep_link, verified_saving, category, offer_url, saving_amount_gbp, locality_context,
         provider_name, agent_headline, architect_prose, research_snapshot,
         is_high_impact, carbon_impact_kg, created_at
       )
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14, $15, $16, $17, $18::jsonb, $19, $20::numeric, NOW())`,
      [
        params.userId?.trim() || null,
        params.postcode ?? null,
        JSON.stringify(params.profileData ?? {}),
        workingMarkdown,
        JSON.stringify(mergedCitations),
        params.elecUnitRateGbpPerKwh ?? null,
        params.gasUnitRateGbpPerKwh ?? null,
        mergedSourceForDb,
        deepResolved,
        verifiedForDb,
        mergedCategory,
        mergedOffer,
        savingForDb,
        params.localityContext ?? null,
        providerName,
        mergedAgentHeadline,
        mergedArchitectProse,
        params.invokePayload !== undefined ? JSON.stringify(params.invokePayload) : null,
        highImpact,
        carbonKg,
      ]
    )
  } catch (e) {
    console.warn('[researchAgent] persistResearchResult failed:', e)
  }
}

export { triggerSupplementalResearch }

export function buildWickResearchUserContext(params: {
  postcode?: string | null
  profileData?: ResearchProfileData | null
}): string {
  const lines: string[] = []
  const pc = (params.postcode?.trim() || params.profileData?.postcode?.trim() || '').replace(/\s+/g, '').trim().toUpperCase()
  if (pc) {
    lines.push(`postcode: ${pc}`)
    const sector = pc.match(/^[A-Z]{1,2}\d[A-Z\d]?\d?/i)?.[0]?.toUpperCase() ?? pc.slice(0, 4)
    lines.push(`locality_context (outcode / BN-style seeds): ${sector}`)
  }
  const p = params.profileData
  if (p) {
    if (p.home_type) lines.push(`home_type: ${p.home_type}`)
    if (p.household) lines.push(`household: ${p.household}`)
    if (p.transport_baseline) lines.push(`transport_baseline: ${p.transport_baseline}`)
    if (p.heating) lines.push(`heating: ${p.heating}`)
    if (p.employment_status) lines.push(`employment_status: ${p.employment_status}`)
    const age = typeof p.age_group === 'string' ? p.age_group : null
    if (age) lines.push(`age_group: ${age}`)
    const g = typeof p.goal === 'string' ? p.goal : null
    if (g) lines.push(`goal: ${g}`)
  }
  return lines.join('\n')
}

/**
 * Fast scrape-sync trigger: Gemini deep search + triplet persist (skips Firecrawl batch).
 * Fits Vercel `maxDuration` for per-category POST triggers.
 */
export async function runTriggerResearchForCategory(params: {
  postcode: string
  category: string
  profileData?: ResearchProfileData | null
  userId?: string | null
  userContext?: string
  /** Prioritise behavioural pattern arbitrage over generic grant listings. */
  lifestyleShift?: boolean
}): Promise<ZeroResearchResult> {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const cat = normalizeResearchCategory(params.category) ?? 'home'
  const local = await getLocalData(pc).catch(() => null)
  const localityContext = local
    ? [local.locality, local.council, local.region].filter(Boolean).join(', ')
    : null

  let markdown = [
    `## Location\nPostcode: ${pc}`,
    localityContext ? `## Locality\n${localityContext}` : '',
    params.userContext?.trim() ? `## User context\n${params.userContext.trim()}` : '',
    `Target journey category: ${cat}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const citations: ResearchCitation[] = []
  const deep = await deepGeminiSearchUkEnergyMarkdown({
    postcode: pc,
    profileData: params.profileData ?? null,
    localityContext,
    category: cat,
    lifestyleShift: params.lifestyleShift,
  })
  if (deep) {
    markdown = `${markdown}\n\n---\n\n${deep.markdown}`
    citations.push(...deep.citations)
  }

  const parsed = await parseApril2026UnitRatesFromMarkdown(markdown)
  await persistResearchResult({
    userId: params.userId,
    postcode: pc,
    profileData: params.profileData,
    markdown,
    citations,
    category: cat,
    localityContext,
    elecUnitRateGbpPerKwh:
      parsed.electricityGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH / 100,
    gasUnitRateGbpPerKwh: parsed.gasGbpPerKwh ?? APRIL_2026_TRUTH_PENCE.GAS_PER_KWH / 100,
    sourceUrl: PRICE_CAP_SOURCE_URL,
    invokePayload: { trigger: 'scrape-sync-fast', category: cat },
  })

  return { markdown, citations }
}

/**
 * Run ZeroResearch for a location (postcode + optional profileData). Uses Firecrawl-backed
 * `runZeroResearch` when supplemental Firecrawl/Gemini persistence did not already run.
 */
export async function runZeroResearchWithProfile(params: {
  postcode?: string | null
  region?: string | null
  profileData?: ResearchProfileData | null
  userContext?: string
  persistToNeon?: boolean
  userId?: string | null
  /** When set, biases Gemini triplet + persist toward this `research_results.category`. */
  category?: string | null
}): Promise<ZeroResearchResult> {
  const gatewayResult = await triggerSupplementalResearch({
    postcode: params.postcode,
    region: params.region,
    profileData: params.profileData,
    persistToNeon: params.persistToNeon,
    userId: params.userId,
    category: params.category ?? null,
  })
  if (gatewayResult && !isWeakResearchMarkdown(gatewayResult.markdown)) return gatewayResult

  const catNorm = normalizeResearchCategory(params.category)
  const catLine = catNorm ? `\n\nTarget journey category for this research pass: ${catNorm}` : ''
  const wick = buildWickResearchUserContext({
    postcode: params.postcode,
    profileData: params.profileData ?? null,
  })
  const userContext = [
    params.userContext ?? (wick.trim() ? wick : undefined),
    catLine || undefined,
  ]
    .filter(Boolean)
    .join('')
  const result = await runZeroResearch({
    postcode: params.postcode ?? params.profileData?.postcode ?? null,
    region: params.region,
    userContext: userContext.length > 0 ? userContext : undefined,
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
      category: params.category ?? null,
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
    await repairResearchResultsMissingHeadlines({
      userId: params.userId,
      postcode: params.postcode,
      profileData: params.profileData ?? null,
    })
  }
  return result
}
