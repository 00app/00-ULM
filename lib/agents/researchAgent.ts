/**
 * ZeroResearch agent — Location-triggered UK 2026 data research (Firecrawl seeds + Gemini).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  ARTICLE_GATEWAY_MODEL_CHAIN,
  EDITORIAL_MAGAZINE_CONSTRAINT,
  GEMINI_DIRECT_ARTICLE,
  GEMINI_DIRECT_ZONE,
  GEMINI_PRECISION_TEMPERATURE,
  generateResearchText,
} from '@/lib/intelligence/aiGateway'
import {
  buildCategoryFirecrawlSeedUrls,
  buildEmploymentAwareResearchSeeds,
  buildLocalizedResearchPrefix,
  JOURNEY_FREE_SEEDS,
} from '@/lib/intelligence/researchProfilePayload'
import { buildDataTruthContextBlock } from '@/lib/intelligence/answerFunnelRouter'
import { buildAnswerFunnelFromResearchProfile } from '@/lib/intelligence/enrichProfileDataFromGenome'
import { readHomePowerFromGenome } from '@/lib/data/utilitiesFreeApis'
import { buildUtilitiesResearchContext } from '@/lib/intelligence/utilitiesLaneRules'
import { shouldSkipDeepGeminiSearch, shouldSkipFirecrawlScrape, shouldPreferMechanicalTripletInBucket } from '@/lib/intelligence/scrapeBoundaries'
import { isLlmRateLimited } from '@/lib/intelligence/llmRateLimit'
import { listConfiguredBucketProviders } from '@/lib/intelligence/bucketFailover'
import {
  buildLaneLockPromptBlock,
  buildPostcodeDnaBlock,
  resolveSurgicalJourneyKey,
  SURGICAL_FIRECRAWL_MAX_URLS,
} from '@/lib/intelligence/topicShield'
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
import { getLocalData, stripUnparishedArea } from '@/lib/local/getLocalData'
import { stripContentSystemLeakage } from '@/lib/zone/contentProseSanitize'
import { sanitizeZoneOfferUrl, sanitizeZoneOfferUrlForPersist } from '@/lib/zone/offerUrlGuard'
import { forensicMateBannedPromptLine, ZONE_WARM_AUDITOR_THREE_BEAT } from '@/lib/zone/zoneVoice'
import { polishWarmAuditorProse } from '@/lib/zone/warmAuditorCopy'
import { firecrawlZoneResearchV2JsonSchema } from '@/lib/schemas/firecrawlZoneResearchV2'
import {
  APRIL_2026_TRUTH_PENCE,
  MARCH_2026_ECONOMY,
  PRICE_CAP_SOURCE_URL,
  TRUTH_2026_MARCH,
  TRUTH_2026_JULY,
} from '@/lib/brains/constants'
import { JOURNEY_IDS } from '@/lib/journeys'
import {
  AFFLUENCE_AUDITOR_PROTOCOL,
  GRANTS_AND_BILLS_CATEGORY_PROTOCOL,
  isAllowedResearchCategory,
} from '@/lib/intelligence/researchCategories'
import { buildAffluenceAuditorPromptBlock } from '@/lib/zone/affluenceCheck'
import {
  clampZoneBentoHeadline,
  headlineFromArchitectProse,
  MAX_EXPANDED_VIEW_HEADLINE_WORDS,
  MAX_JOURNEY_CARD_HEADLINE_WORDS,
  MAX_ZONE_CARD_HEADLINE_WORDS,
  MIN_JOURNEY_CARD_HEADLINE_WORDS,
  MIN_ZONE_CARD_HEADLINE_WORDS,
  normalizeCardHeadlineKey,
  stripExpandedCardTitleNoise,
  ZONE_BENTO_HOOK,
  zoneCardHeadlineFromRaw,
} from '@/lib/soloFocusCopy'
import {
  calculateMoney,
  calculateUtilities,
  calculateHome,
  calculateTravel,
  calculateFood,
  calculateShopping,
  calculateTech,
  calculateWaste,
  calculateWater,
  calculateHolidays,
  applyEmploymentFinancialPhysics,
  normalizeEmploymentStatus,
} from '@/lib/brains/calculations'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { homeHeatingSchemeForUser } from '@/lib/zone/homeHeatingScheme'
import { ukCountryFromPostcode } from '@/lib/zone/ukCountryFromPostcode'
import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'
import { fetchPvgisSolarEstimate } from '@/lib/intelligence/pvgisClient'
import {
  getLiveCarbonIntensity,
  getGenerationMix,
  renewablesSharePercent,
} from '@/lib/data/ukPublicInfrastructureApis'

/** Journey mother-card headline bounds — passed to clampZoneBentoHeadline for all category cards. */
const JOURNEY_CARD_HEADLINE_BOUNDS = {
  min: MIN_JOURNEY_CARD_HEADLINE_WORDS,
  max: MAX_JOURNEY_CARD_HEADLINE_WORDS,
}

/**
 * A genuine LLM headline a couple of words under the 9-word target still carries real, specific
 * content (locality, £ figure, benefit) — discarding it for the fully generic per-category
 * template throws away more signal than a short-by-a-word headline costs. Only headlines this
 * far below the floor (or empty, or already matching a known generic hook) are too short to trust.
 */
const HEADLINE_NEAR_MISS_TOLERANCE_WORDS = 3
const HEADLINE_MECHANICAL_FLOOR_WORDS = Math.max(
  1,
  MIN_JOURNEY_CARD_HEADLINE_WORDS - HEADLINE_NEAR_MISS_TOLERANCE_WORDS
)
/** Same bounds as JOURNEY_CARD_HEADLINE_BOUNDS but with the relaxed near-miss floor, so a headline
 * accepted as a near-miss isn't immediately re-collapsed by clampZoneBentoHeadline's own
 * (stricter) min-word check right after it. */
const JOURNEY_CARD_HEADLINE_BOUNDS_NEAR_MISS = {
  min: HEADLINE_MECHANICAL_FLOOR_WORDS,
  max: MAX_JOURNEY_CARD_HEADLINE_WORDS,
}

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
  /** Geocoded town for Warm Auditor P1 (e.g. Littlehampton) — not the postcode. */
  locality_display?: string | null
  home_type?: string | null
  home_power?: string | null
  household?: string | null
  transport_baseline?: string | null
  heating?: string | null
  tenure?: string | null
  employment_status?: string | null
  household_income_bracket?: string | null
  primary_goal?: string | null
  /** Bath/shower/both — feeds calculateWater's wash_preference branch. */
  wash_preference?: string | null
  /** none/one_two/three_plus flights a year — feeds calculateHolidays' annual_flights branch. */
  flight_frequency?: string | null
  /** Optional house number / name for EPC address disambiguation at postcode. */
  house_number?: string | null
  /**
   * Loop-question answers (YES / TRY IT / NOT YET style, raw option value) — the six categories
   * below have no dedicated onboarding question, so these post-close loop nudges are the only
   * real per-user signal available. Read by calculateFood/Shopping/Tech/Waste/Money in
   * lib/brains/calculations.ts. Currently populated only when the client includes them in the
   * research trigger payload (not yet a durable server-side profile field — see task tracker).
   */
  food_plant_shift?: string | null
  shopping_repair_first?: string | null
  tech_standby_off?: string | null
  waste_compost?: string | null
  food_waste_cut?: string | null
  money_smart_tariff?: string | null
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
  household_income_bracket?: string | null
  primary_goal?: string | null
  home_power?: string | null
  house_number?: string | null
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
    household_income_bracket:
      readStringProfileField(profileRow, ['household_income_bracket', 'householdIncomeBracket']) ??
      readStringProfileField(usersRow, ['household_income_bracket', 'householdIncomeBracket']),
    primary_goal:
      readStringProfileField(profileRow, ['primary_goal', 'primaryGoal']) ??
      readStringProfileField(usersRow, ['primary_goal', 'primaryGoal']),
    goal:
      readStringProfileField(profileRow, ['goal', 'profile_goal', 'primary_goal']) ??
      readStringProfileField(usersRow, ['goal', 'profile_goal', 'primary_goal']),
    home_power:
      readStringProfileField(profileRow, ['home_power', 'homePower', 'profile_home_power']) ??
      readStringProfileField(usersRow, ['home_power', 'homePower', 'profile_home_power']) ??
      readHomePowerFromGenome(userGenome),
    house_number:
      readStringProfileField(profileRow, ['house_number', 'houseNumber']) ??
      readStringProfileField(userGenome, ['house_number', 'houseNumber']),
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
  'https://www.moneysavingexpert.com/cheapenergyclub/',
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
  profileData?: ResearchProfileData | null
}): Promise<ZeroResearchResult> {
  const { region, userContext, profileData } = params
  const postcode = params.postcode?.replace(/\s+/g, '').toUpperCase() || ''
  if (!postcode) return { markdown: 'No outcode detected', citations: [], error: 'No outcode detected' }
  const citations: ResearchCitation[] = []
  const sections: string[] = []

  const seedUrls = [...UK_2026_SEED_URLS]
  for (const url of buildEmploymentAwareResearchSeeds(profileData ?? null)) {
    if (!seedUrls.includes(url)) seedUrls.unshift(url)
  }
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
  const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
  const batchUrls = seedUrls.slice(0, 8)
  const scrapedBatch = await fetchMarkdownForUrlsFreeFirst(batchUrls, {
    minChars: 80,
    maxUrls: batchUrls.length,
    fallback: (missed) => fetchFirecrawlMarkdownForUrls(missed, { minChars: 80, maxUrls: missed.length }),
  })
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
 * Output keys align with `research_results`: `category`, `saving_amount_gbp`, `offer_url`, `agent_headline` (9–12 words — MIN_JOURNEY_CARD_HEADLINE_WORDS, not the 8–10 Zone-face tier used by content-architect),
 * `architect_prose` (exactly three paragraphs, \\n\\n separated, max 40 words each, no UI section labels in text). Carbon kg for Zone
 * cards comes from `buildUserImpact` / scrapes, not a separate `verified_saving_kg` column on this row (see
 * `verified_saving` / impact pipeline elsewhere).
 */
/**
 * Map retired direct-API ids → the current default (see Google "no longer available to new
 * users"). Dated ids get retired over time (gemini-1.5/2.0, and as of 2026-07 gemini-2.5 too, on
 * newer API-key projects) — always redirect to `fallback` (FLASH_DEFAULT-derived, kept current in
 * geminiModels.ts) rather than a second hardcoded id here, so this doesn't go stale again on its
 * own schedule. The "-latest" aliases are never retired by this check.
 */
function resolveGeminiResearchModel(
  envVal: string | undefined,
  fallback: string,
  label: string
): string {
  const v = envVal?.trim()
  if (!v) return fallback
  if (!v.includes('-latest') && /gemini-1\.5|gemini-2\.0|gemini-2\.5|flash-lite/i.test(v)) {
    console.warn(`[researchAgent] ${label}=${v} unavailable on direct API; using ${fallback}`)
    return fallback
  }
  return v
}

const RESEARCH_TRIPLET_MODEL = resolveGeminiResearchModel(
  process.env.GEMINI_RESEARCH_MODEL,
  GEMINI_DIRECT_ARTICLE,
  'GEMINI_RESEARCH_MODEL'
)
/** Recovery / backfill when triplet fields are missing — user-facing “Deep Gemini Search”. */
const RESEARCH_RECOVERY_MODEL = resolveGeminiResearchModel(
  process.env.GEMINI_RESEARCH_RECOVERY_MODEL,
  GEMINI_DIRECT_ZONE,
  'GEMINI_RESEARCH_RECOVERY_MODEL'
)

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
async function fetchCategoryFirecrawlResearch(params: {
  postcode: string
  category: string
  profileData?: ResearchProfileData | null
  userContext?: string | null
  surgical?: boolean
}): Promise<{ markdown: string; citations: ResearchCitation[] }> {
  const { getFirecrawlApiKey } = await import('@/lib/agents/scraper')
  if (!getFirecrawlApiKey()?.trim()) return { markdown: '', citations: [] }

  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const cat = normalizeResearchCategory(params.category) ?? 'home'
  const journeyKey = resolveSurgicalJourneyKey(cat) ?? normalizeCategoryToJourneyKey(cat)
  const funnel = buildAnswerFunnelFromResearchProfile(params.profileData ?? null, {
    activeJourneyId: journeyKey,
  })
  const truthBlock = buildDataTruthContextBlock({
    profileSignals: funnel.profileSignals,
  })
  const prefix = buildLocalizedResearchPrefix({
    postcode: pc,
    profileData: funnel.profileSignals,
    category: cat,
    userContext: [params.userContext?.trim() ?? '', truthBlock].filter(Boolean).join('\n\n'),
  })
  const surgical = params.surgical === true
  const seeds = buildCategoryFirecrawlSeedUrls({
    postcode: pc,
    category: cat,
    profileData: funnel.profileSignals,
    surgical,
    extraSeedUrls: funnel.extraSeedUrls,
    deprioritizeMeansTestedGrants: funnel.deprioritizeMeansTestedGrants,
  })
  const { fetchFirecrawlMarkdownForUrls } = await import('@/lib/agents/scraper')
  const maxUrls = surgical
    ? Math.min(SURGICAL_FIRECRAWL_MAX_URLS, seeds.length)
    : Math.min(6, seeds.length)
  const scraped = await fetchFirecrawlMarkdownForUrls(seeds, {
    minChars: 120,
    maxUrls,
  })
  if (!scraped.length) return { markdown: '', citations: [] }

  const citations: ResearchCitation[] = scraped.map((row) => ({
    source_name: row.title?.trim() || new URL(row.url).hostname.replace(/^www\./, ''),
    url: row.url,
    snippet: row.markdown.slice(0, 420),
    title: row.title,
  }))
  const body = scraped
    .map((row) => `### Live source: ${row.title || row.url}\n${row.markdown.slice(0, 4500)}`)
    .join('\n\n---\n\n')
  return {
    markdown: `## Firecrawl (localized UK offers)\n\n${prefix}\n\n---\n\n${body}`,
    citations,
  }
}

export async function deepGeminiSearchUkEnergyMarkdown(params: {
  postcode: string
  profileData?: ResearchProfileData | null
  localityContext?: string | null
  category?: string | null
  lifestyleShift?: boolean
  userContext?: string | null
}): Promise<{ markdown: string; citations: ResearchCitation[] } | null> {
  if (shouldSkipDeepGeminiSearch()) return null
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  if (pc.length < 4) return null
  const profileBlock = buildResearchProfileAuditorContext(params.profileData ?? null)
  const locality = params.localityContext?.trim()
  const cat = normalizeResearchCategory(params.category ?? '')
  const journeyKey = resolveSurgicalJourneyKey(cat ?? '') ?? normalizeCategoryToJourneyKey(cat ?? 'home')
  const funnel = buildAnswerFunnelFromResearchProfile(params.profileData ?? null, {
    activeJourneyId: journeyKey,
  })
  const truthBlock = buildDataTruthContextBlock({ profileSignals: funnel.profileSignals })
  const localizedPrefix = buildLocalizedResearchPrefix({
    postcode: pc,
    profileData: funnel.profileSignals,
    category: cat,
    userContext: [locality ? `locality: ${locality}` : '', params.userContext?.trim() ?? '', truthBlock]
      .filter(Boolean)
      .join('\n'),
  })
  const postcodeDna = buildPostcodeDnaBlock({
    postcode: pc,
    localityContext: locality ?? null,
    journeyKey,
  })
  const laneLock = buildLaneLockPromptBlock(journeyKey, {
    employment_status: params.profileData?.employment_status,
    household_income_bracket: params.profileData?.household_income_bracket,
    home_power: params.profileData?.home_power,
  })
  const categoryLine = cat
    ? params.lifestyleShift
      ? `Lifestyle shift / pattern arbitrage for **${cat}**: rail vs flight, EV swap, local vs long-haul holidays, meal shifts — not generic grant homepages. One concrete £/year trade-off and one deep-linked https application or booking URL copied from live UK sources.`
      : `Focus this pass on the **${cat}** journey (UK household money/carbon) with a concrete £/year figure and one https offer URL in the prose.`
    : ''
  const prompt = `${localizedPrefix}

${postcodeDna}

${laneLock}

You are a trusted UK household savings guide (April 2026) — calm, clear, and gently direct. Write markdown for postcode **${pc}**${locality ? ` (${locality})` : ''}.
CURRENT_DOMAIN: ${cat}. Do not reference other journey domains.
${categoryLine}
Pull real localized deals from the profile context — no placeholder £0 rows. Include one numeric **£/year** saving and at least one **https://** deep link to a live UK offer or scheme page.
Use UK English, editorial and direct (not dashboard/API jargon). Reference sources inline.
${EDITORIAL_MAGAZINE_CONSTRAINT}
${profileBlock}
Return markdown only (no JSON, no code fences).`

  try {
    const tag = params.category?.trim().toLowerCase() || 'energy-recovery'
    const { text: raw } = await generateResearchText({
      prompt,
      tag,
      tier: 'zone',
      maxOutputTokens: journeyKey ? 1536 : 2048,
      temperature: GEMINI_PRECISION_TEMPERATURE,
    })
    const text = raw.trim()
    if (text.length < 80) return null
    const trustedJourney = journeyKey ?? normalizeCategoryToJourneyKey(cat ?? 'home')
    const parsed = extractHttpsCitationsFromMarkdown(text, 'Gemini deep search')
    const deepCites = parsed.filter((c) => isDeepLinkedUkOfferUrl(c.url))
    const citationUrl = params.lifestyleShift
      ? trustedUrlForJourney(trustedJourney)
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
const ALLOWED_TRIPLET_CATEGORIES = [...JOURNEY_IDS, 'general', 'bills'] as const

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

/** Clip to ~maxWords without cutting mid-sentence — prefer the last full sentence inside (or just past) budget. */
function clipArchitectParagraphToMaxWords(p: string, maxWords: number): string {
  const trimmed = p.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return trimmed

  // Search for the last sentence-ending punctuation within budget, then a short grace window
  // past it (CTA sentences often run a few words over) before falling back to a hard word cut.
  const GRACE_WORDS = 15
  const searchWords = words.slice(0, maxWords + GRACE_WORDS).join(' ')
  const sentenceEnds = [...searchWords.matchAll(/[.!?](?=\s|$)/g)]
  for (let i = sentenceEnds.length - 1; i >= 0; i--) {
    const idx = sentenceEnds[i].index ?? -1
    if (idx < 0) continue
    const candidate = searchWords.slice(0, idx + 1).trim()
    if (candidate.split(/\s+/).filter(Boolean).length <= maxWords + GRACE_WORDS) {
      return candidate
    }
  }
  return words.slice(0, maxWords).join(' ')
}

/** Exactly three `\n\n`-separated paragraphs; reject mashed single-paragraph output; clip each paragraph to max words. */
function normalizeArchitectProseThreeParagraphs(ap: string | undefined): string | undefined {
  const polished = polishWarmAuditorProse(ap ?? '', MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH)
  if (polished) return polished
  if (!ap?.trim()) return undefined
  const cleaned = stripContentSystemLeakage(ap)
  const parts = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => clipArchitectParagraphToMaxWords(stripContentSystemLeakage(p), MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH))
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

/** Zone / expanded headlines for Neon `agent_headline` + Solo Focus H1. */
function normalizeGeminiAgentHeadline(
  raw: string | undefined,
  maxWords: number = MAX_EXPANDED_VIEW_HEADLINE_WORDS
): string | undefined {
  if (!raw?.trim()) return undefined
  const cleaned = stripExpandedCardTitleNoise(raw.trim())
  const clipped = zoneCardHeadlineFromRaw(cleaned, cleaned, maxWords)
  return clipped.length > 0 ? clipped.slice(0, 600) : undefined
}

/** When Gemini / gateway JSON triplet fails, recover £/URL/prose from research markdown (postcode-parameterized audits). */
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

/**
 * Smaller/faster bucket models (e.g. Groq's llama-3.1-8b-instant) reliably produce a well-formed
 * JSON *shape* but frequently fail to escape literal newlines inside long multi-paragraph string
 * values (architect_prose) — raw control characters inside a JSON string are illegal per spec, so
 * JSON.parse rejects the whole payload even though every field is otherwise present and correct.
 * Escapes newlines/carriage-returns only while inside a quoted string (tracking escape state so
 * already-valid `\n` sequences aren't double-escaped) — structural whitespace between tokens is
 * untouched.
 */
function sanitizeJsonEmbeddedNewlines(text: string): string {
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      result += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      result += ch === '\n' ? '\\n' : '\\r'
      continue
    }
    result += ch
  }
  return result
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
    const j = JSON.parse(sanitizeJsonEmbeddedNewlines(t.slice(start, end + 1))) as Record<string, unknown>
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
    const zoneHeadlineRaw =
      typeof j.agent_headline === 'string' ? j.agent_headline : undefined
    const expandedHeadlineRaw =
      typeof j.expanded_headline === 'string' ? j.expanded_headline : zoneHeadlineRaw
    const agent_headline =
      normalizeGeminiAgentHeadline(zoneHeadlineRaw, MAX_ZONE_CARD_HEADLINE_WORDS) ??
      normalizeGeminiAgentHeadline(expandedHeadlineRaw, MAX_ZONE_CARD_HEADLINE_WORDS)
    return { category, saving_amount_gbp, offer_url, agent_headline, architect_prose }
  } catch {
    return null
  }
}

function buildGoalDirectiveBlock(goal?: string | null): string {
  const g = String(goal ?? '').toLowerCase().trim()
  if (g === 'money' || g === 'save' || g === 'save_money') {
    return `Goal directive — MONEY: Lead every recommendation with the verified £/year saving first. Use active CTA verbs: Switch, Compare, Claim. Minimise carbon language unless it directly inflates the £ figure. Foreground tariff switching, bill grants, and cashback over low-carbon-only schemes.\n\n`
  }
  if (g === 'carbon' || g === 'reduce' || g === 'reduce_carbon') {
    return `Goal directive — CARBON: Lead every recommendation with the kg CO₂ saved per year first. Foreground low-carbon mechanisms: solar, heat pumps, EV, plant-based diet, circular economy. Show £ saving only when it reinforces the sustainability narrative, not as the headline.\n\n`
  }
  return `Goal directive — BALANCED: Quote both £/year saving AND kg CO₂ saved. Prioritise dual-benefit schemes where one action yields meaningful numbers on both axes (solar PV, EV smart tariff, heat pump). Neither metric should dominate.\n\n`
}

function buildResearchProfileAuditorContext(data: ResearchProfileData | null | undefined): string {
  if (!data || typeof data !== 'object') return ''
  const townLine =
    typeof data.locality_display === 'string' && data.locality_display.trim()
      ? `Town for prose (paragraph 1 — use this name, never the postcode): ${data.locality_display.trim()}\n\n`
      : ''
  const goalDirective = buildGoalDirectiveBlock(data.primary_goal ?? data.goal)
  const affluence = buildAffluenceAuditorPromptBlock({
    employment_status: data.employment_status,
    postcode: data.postcode,
    household_income_bracket: data.household_income_bracket,
    primary_goal: data.primary_goal ?? data.goal,
  })
  const rows: string[] = []
  for (const [key, raw] of Object.entries(data)) {
    if (raw == null) continue
    const s = String(raw).trim()
    if (!s) continue
    rows.push(`- ${key}: ${s.length > 280 ? `${s.slice(0, 280)}…` : s}`)
    if (rows.length >= 24) break
  }
  if (!rows.length) return `${townLine}${goalDirective}${affluence}`
  return `${townLine}${goalDirective}${affluence}Household auditing context (treat as ground truth — interrogate the markdown through this lens, not generic “grants” SEO):\n${rows.join('\n')}\n\n`
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
  const prompt = `${pc}${profileBlock}${categoryBias}You are a trusted Zero Zero guide — warm, empathetic UK copy from scraped evidence. No dashboard speak, API jargon, or robotic summaries.

${EDITORIAL_MAGAZINE_CONSTRAINT}

${AFFLUENCE_AUDITOR_PROTOCOL}

${GRANTS_AND_BILLS_CATEGORY_PROTOCOL}

From the markdown below, return ONLY valid JSON (no markdown code fence) with exactly these keys:
- "category": one of: ${journeyList} — the single best thematic fit for the main opportunity in the text.
- "saving_amount_gbp": non-negative number with up to two decimal places — annual GBP saving grounded in the scraped text (use 0 only if truly none inferable). **Consistency check before you answer:** if any £ figure appears anywhere in the "architect_prose" you are about to write, "saving_amount_gbp" MUST equal that figure — copy the number across. Never submit 0 here if the prose you wrote names a £ amount; that is a contradiction and the response will be rejected.
- "offer_url": one https URL copied verbatim from the markdown or citation context. If no live URL exists, return an empty string.
- "agent_headline": **Zone card heading** — **9 to 12 words** (must be at least 9 — anything shorter gets rejected and replaced by a generic template, wasting this generation entirely), punchy and benefit-driven (e.g. "book your boiler service before the april price rise" — count the words before you answer). No colons. No section labels.
- "expanded_headline": **Expanded Solo Focus hook heading** — **10 to 20 words** (2–3 lines); benefit-led lifestyle hook for their town/setup, not a postcode. Optional; if omitted, agent_headline may be reused.
- "architect_prose": exactly **THREE** paragraphs for Solo Focus (blank line between). **Hard cap: each paragraph at most ${MAX_ARCHITECT_PROSE_WORDS_PER_PARAGRAPH} words.**
${ZONE_WARM_AUDITOR_THREE_BEAT}
  **Banned in prose:** "What:", "Why:", "How:", bullets, markdown (##, **), raw postcodes, "aviation factors", "tariff pressure", "Sure!", "I can help", dev-speak (morph, pipeline, tile).
  ${forensicMateBannedPromptLine()}
  **Headlines:** agent_headline stays punchy uppercase fragments; architect_prose body is sentence case / lowercase where natural.

Markdown:
---
${markdown.slice(0, shouldPreferMechanicalTripletInBucket() ? 12_000 : 28_000)}`
  try {
    const tag = normalizeResearchCategory(options?.categoryHint ?? '') || 'architect-triplet'
    const { text } = await generateResearchText({
      prompt,
      tag,
      tier: 'article',
      maxOutputTokens: shouldPreferMechanicalTripletInBucket() ? 512 : 1536,
      temperature: 0.32,
      models: options?.model?.trim()
        ? [`google/${options.model.trim().replace(/^google\//, '')}`, ...ARTICLE_GATEWAY_MODEL_CHAIN]
        : undefined,
    })
    return parseResearchTripletJson(text)
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
  if (isLlmRateLimited(listConfiguredBucketProviders())) {
    return { markdown: params.markdown, triplet: null, extraCitations: [] }
  }
  if (shouldPreferMechanicalTripletInBucket()) {
    // Silent otherwise: this is a single env var (ALLOW_LLM_TRIPLET) away from every trigger/
    // repair request going mechanical-only with zero indication anywhere in logs that LLM
    // synthesis was never attempted at all (not rate-limited, not failed — never even tried).
    console.warn(
      '[researchAgent] mechanical-only mode active (ALLOW_LLM_TRIPLET not set truthy in bucket_failover mode) — skipping LLM triplet extraction entirely'
    )
    return { markdown: params.markdown, triplet: null, extraCitations: [] }
  }
  let markdown = params.markdown
  const extraCitations: ResearchCitation[] = []
  const extractOpts = { categoryHint: params.categoryHint ?? null }
  const bucketMode = shouldSkipDeepGeminiSearch()

  const alreadyHasDeepGemini = /## deep gemini search/i.test(markdown)
  if (
    !bucketMode &&
    isWeakResearchMarkdown(markdown) &&
    !alreadyHasDeepGemini &&
    params.postcode?.trim()
  ) {
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
  if (!bucketMode && researchTripletNeedsRecovery(triplet)) {
    triplet = await extractResearchTripletWithGemini(markdown, params.postcode, params.profileData, {
      ...extractOpts,
      model: RESEARCH_RECOVERY_MODEL,
    })
  }
  if (!bucketMode && researchTripletNeedsRecovery(triplet) && params.postcode?.trim()) {
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
  rowId?: number | null
  userId?: string | null
  postcode?: string | null
  profileData?: ResearchProfileData | null
  limit?: number
  /** Cron/Hermes: BUS + Ofgem mechanical only — skip slow Gemini per row. Pass `deep=1` on cron to enable Gemini. */
  mechanicalOnly?: boolean
  /** Pink-lock categories — do not spend Gemini repairing visited journeys. */
  skipVisitedCategories?: string[]
}): Promise<number> {
  const pool = getDbPool()
  const limit = Math.min(Math.max(params.limit ?? 6, 1), 20)
  const pc = params.postcode?.replace(/\s+/g, '').trim() ?? ''
  const uid = params.userId?.trim() ?? ''
  const rowId =
    params.rowId != null && Number.isFinite(params.rowId) && params.rowId > 0
      ? Math.floor(params.rowId)
      : null
  type Row = {
    id: string
    markdown: string
    citations: unknown
    profile_snapshot: unknown
    postcode: string | null
    category: string | null
    offer_url: string | null
    locality_context: string | null
    agent_headline: string | null
    elec_unit_rate_gbp_per_kwh: number | null
    gas_unit_rate_gbp_per_kwh: number | null
  }
  let rows: Row[] = []
  try {
    const incomplete = `(agent_headline IS NULL OR TRIM(agent_headline) = '')
           OR architect_prose IS NULL OR TRIM(architect_prose) = ''
           OR saving_amount_gbp IS NULL OR COALESCE(saving_amount_gbp, 0) <= 0
           OR (
             agent_headline IS NOT NULL
             AND cardinality(regexp_split_to_array(trim(agent_headline), '\\s+')) < ${MIN_ZONE_CARD_HEADLINE_WORDS}
           )
           OR (
             offer_url ILIKE '%ofgem.gov.uk%'
             AND (offer_url ILIKE '%price-cap%' OR offer_url ILIKE '%energy-advice%')
             AND LOWER(COALESCE(category, '')) NOT IN ('utilities', 'bills')
           )`
    if (rowId != null) {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category,
                offer_url, locality_context, agent_headline,
                elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh
         FROM research_results
         WHERE id = $1
           AND (${incomplete})`,
        [rowId]
      )
      rows = r.rows
    } else if (uid) {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category,
                offer_url, locality_context, agent_headline,
                elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh
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
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category,
                offer_url, locality_context, agent_headline,
                elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh
         FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
           AND (${incomplete})
         ORDER BY created_at DESC NULLS LAST
         LIMIT $2`,
        [pc, limit]
      )
      rows = r.rows
    } else {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category,
                offer_url, locality_context, agent_headline,
                elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh
         FROM research_results
         WHERE (${incomplete})
         ORDER BY created_at DESC NULLS LAST
         LIMIT $1`,
        [limit]
      )
      rows = r.rows
    }
  } catch (e) {
    console.warn('[researchAgent] repairResearchResultsMissingHeadlines query failed:', e)
    return 0
  }

  const skipVisited = new Set(
    (params.skipVisitedCategories ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean)
  )

  let repaired = 0
  for (const row of rows) {
    const cat = (row.category ?? '').trim().toLowerCase()
    if (cat && skipVisited.has(cat)) continue
    const profileForFallback =
      row.profile_snapshot && typeof row.profile_snapshot === 'object' && !Array.isArray(row.profile_snapshot)
        ? (row.profile_snapshot as ResearchProfileData)
        : null
    const mechanical = mechanicalCategoryTripletFallback({
      category: row.category,
      offerUrl: row.offer_url,
      localityContext: row.locality_context,
      postcode: row.postcode,
      profileData: profileForFallback,
      liveRates:
        typeof row.elec_unit_rate_gbp_per_kwh === 'number' && typeof row.gas_unit_rate_gbp_per_kwh === 'number'
          ? { elecGbpPerKwh: row.elec_unit_rate_gbp_per_kwh, gasGbpPerKwh: row.gas_unit_rate_gbp_per_kwh }
          : null,
    })
    if (mechanical) {
      try {
        const journeyKey = normalizeCategoryToJourneyKey(mechanical.category)
        // Same near-miss tolerance as the live persist gate in persistResearchResult (see
        // HEADLINE_MECHANICAL_FLOOR_WORDS above): a genuine headline this repair job would
        // otherwise catch on word count alone is left alone if it's within the near-miss window
        // and doesn't already match a known generic hook. Without this, a headline the live gate
        // just accepted as genuine gets overwritten right back to the template by this same-request
        // sweep (app/api/scrape-sync/route.ts calls this immediately after every trigger).
        const currentHeadline = (row.agent_headline ?? '').trim()
        const currentHeadlineWordCount = currentHeadline
          ? currentHeadline.split(/\s+/).filter(Boolean).length
          : 0
        const currentHeadlineMatchesKnownGenericHook =
          currentHeadline.length > 0 &&
          Object.values(ZONE_BENTO_HOOK).some(
            (hook) => hook != null && normalizeCardHeadlineKey(hook) === normalizeCardHeadlineKey(currentHeadline)
          )
        const needsHeadlineRepair =
          currentHeadlineWordCount > 0 &&
          (currentHeadlineWordCount < HEADLINE_MECHANICAL_FLOOR_WORDS || currentHeadlineMatchesKnownGenericHook)
        // The WHERE clause above (`incomplete`) is an OR of independent conditions — a row can
        // land here missing only ONE of headline/prose/£. Previously this UPDATE overwrote all
        // three unconditionally whenever ANY one was deficient, silently destroying a genuine £
        // (or prose, or headline) that had nothing wrong with it. Each field now only takes the
        // template value when that specific field was the actual reason for selection, and
        // is_mechanical_fallback / is_headline_mechanical_fallback are set per-field to match —
        // never forced true for a field that stayed genuine.
        await pool.query(
          `UPDATE research_results
           SET agent_headline = CASE
                 WHEN agent_headline IS NULL OR TRIM(agent_headline) = '' OR $7::boolean
                 THEN $2
                 ELSE agent_headline
               END,
               architect_prose = CASE
                 WHEN architect_prose IS NULL OR TRIM(architect_prose) = ''
                 THEN $3
                 ELSE architect_prose
               END,
               saving_amount_gbp = CASE
                 WHEN saving_amount_gbp IS NULL OR saving_amount_gbp <= 0
                 THEN $4::numeric
                 ELSE saving_amount_gbp
               END,
               category = COALESCE($5, category),
               offer_url = COALESCE($6, offer_url),
               source_url = COALESCE($6, source_url),
               is_mechanical_fallback = is_mechanical_fallback
                 OR saving_amount_gbp IS NULL OR saving_amount_gbp <= 0,
               is_headline_mechanical_fallback = is_headline_mechanical_fallback
                 OR agent_headline IS NULL OR TRIM(agent_headline) = '' OR $7::boolean
           WHERE id::text = $1`,
          [
            row.id,
            clampZoneBentoHeadline(mechanical.agent_headline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS),
            mechanical.architect_prose,
            mechanical.saving_amount_gbp,
            mechanical.category,
            mechanical.offer_url,
            needsHeadlineRepair,
          ]
        )
        repaired += 1
        continue
      } catch (e) {
        console.warn('[researchAgent] repair mechanical fallback failed:', e)
      }
    }

    if (params.mechanicalOnly) continue

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
    const headline = clampZoneBentoHeadline(
      normalizeGeminiAgentHeadline(triplet?.agent_headline, MAX_JOURNEY_CARD_HEADLINE_WORDS) ??
        triplet?.agent_headline ??
        '',
      normalizeCategoryToJourneyKey(row.category ?? triplet?.category ?? 'home'),
      JOURNEY_CARD_HEADLINE_BOUNDS
    )
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
         WHERE id::text = $1`,
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

function outwardFromPostcode(postcode?: string | null): string {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  return pc.match(/^[A-Z]{1,2}\d[A-Z\d]?/)?.[0] ?? ''
}

/**
 * When Firecrawl/Gemini leave only `offer_url` (e.g. BUS gov.uk), still persist mechanical truth
 * so Zone does not fall back to "pattern learned" placeholders.
 */
/**
 * Deterministic pick from a pool — same seed always picks the same index, so a given user/day
 * sees consistent content, but different postcodes/categories/days spread across the pool
 * instead of everyone seeing pool[0] forever. Not cryptographic, just needs to be stable.
 */
function deterministicPoolPick<T>(pool: T[], seed: string): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % pool.length
  return pool[idx]
}

/** EU Commission PVGIS solar yield for a postcode — geocodes via postcodes.io first. Defensive:
 *  any failure (geocode miss, PVGIS timeout/non-200) returns null and the caller keeps the flat
 *  £450 solar constant rather than breaking the card. */
async function resolveLiveSolarYieldForPostcode(
  postcode: string | null | undefined
): Promise<{ annualKwhEstimate: number; yieldFactor: number } | null> {
  const pc = (postcode ?? '').trim()
  if (!pc) return null
  try {
    const geo = await fetchPostcodeGeo(pc)
    if (!geo.found || geo.lat == null || geo.lon == null) return null
    const solar = await fetchPvgisSolarEstimate({ postcode: pc, lat: geo.lat, lon: geo.lon })
    if (!solar.found || !solar.annualKwhEstimate) return null
    return { annualKwhEstimate: solar.annualKwhEstimate, yieldFactor: solar.yieldFactor }
  } catch {
    return null
  }
}

/** NESO Carbon Intensity — national, not postcode-specific. Same defensive null-on-failure shape. */
async function resolveLiveGridSnapshot(): Promise<{
  intensityGPerKwh: number | null
  index: string | null
  renewablesPercent: number | null
} | null> {
  try {
    const [carbon, mix] = await Promise.all([getLiveCarbonIntensity(), getGenerationMix()])
    if (!carbon && mix.length === 0) return null
    return {
      intensityGPerKwh: carbon?.actualGPerKwh ?? carbon?.forecastGPerKwh ?? null,
      index: carbon?.index ?? null,
      renewablesPercent: mix.length > 0 ? renewablesSharePercent(mix) : null,
    }
  } catch {
    return null
  }
}

function mechanicalCategoryTripletFallback(params: {
  category: string | null
  offerUrl: string | null
  localityContext: string | null
  postcode: string | null
  /** When available, money/utilities use this for a real calculateMoney/calculateUtilities
   *  figure instead of a flat guess. Optional and defensive — falls back to the old flat
   *  number if absent, so this never breaks a call site that doesn't have profile data handy. */
  profileData?: ResearchProfileData | null
  /** Live £/kWh (Neon research / pulse-living / Octopus Agile — see resolveLiveUnitRatesForPostcode).
   *  When present, home/utilities' calculateHome/calculateUtilities use TODAY's rate instead of
   *  the static default baked into calculations.ts, so the card £ figure matches what the Zone
   *  dashboard total already uses rather than a second, independently-stale number. */
  liveRates?: {
    elecGbpPerKwh: number
    gasGbpPerKwh: number
  } | null
  /** EU PVGIS annual solar yield for this postcode — see resolveLiveSolarYieldForPostcode.
   *  When present, solar's flat £450 guess scales by the postcode's real irradiance instead of
   *  a national average, and the prose cites the actual kWh/yr estimate. */
  liveSolarYield?: { annualKwhEstimate: number; yieldFactor: number } | null
  /** NESO Carbon Intensity national snapshot — see resolveLiveGridSnapshot. When present, the
   *  carbon card cites today's real gCO2/kWh and renewables share instead of static prose only. */
  liveGrid?: {
    intensityGPerKwh: number | null
    index: string | null
    renewablesPercent: number | null
  } | null
}): {
  saving_amount_gbp: number
  agent_headline: string
  architect_prose: string
  offer_url: string
  category: string
} | null {
  let cat = normalizeResearchCategory(params.category)
  const outward = outwardFromPostcode(params.postcode)
  // params.localityContext may be a stale DB value written before getLocalData() started
  // stripping the Postcodes.io "unparished area" admin suffix — strip it here too so a row
  // saved before that fix never leaks the raw admin term into card prose.
  const townRaw =
    stripUnparishedArea(params.localityContext?.split(',')[0]?.trim()) ||
    outward ||
    ''
  const areaLabel = townRaw || 'your area'
  const areaTag =
    areaLabel.length <= 28 ? areaLabel.toUpperCase() : areaLabel.slice(0, 28).toUpperCase()
  const capTypical = TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP

  if (outward || townRaw) {
    const fallbacks: Record<string, { gbp: number; headlines: string[]; prose: string }> = {
      home: {
        gbp: 180,
        headlines: [
          `seal draughts and loft gaps before you chase the boiler`,
          `fix the fabric before you fix the heating`,
          `loft and draught checks pay back fastest of any home fix`,
          `stop paying to heat the outside air`,
          `a weekend of sealing beats a new boiler quote`,
        ],
        prose: `Older homes in ${areaLabel} leak heat through lofts, draughts, and lagging gaps — sealing those cuts bills before you chase a new boiler.\n\nJuly 2026 bills still track the energy price cap (~£${capTypical}/yr typical dual-fuel) so every wasted kWh hurts until fabric is fixed.\n\nUse the link below to plan loft and draught-proofing work before winter.`,
      },
      utilities: {
        gbp: 120,
        headlines: [
          `compare your household tariff before you fix a deal`,
          `check your meter read before your supplier renews the tariff`,
          `a fixed deal below the cap beats drifting on variable`,
          `standing charges add up fast on the wrong plan`,
          `switch supplier before your fixed term quietly expires`,
        ],
        prose: `${areaLabel} sits under the July 2026 price-cap frame — typical dual-fuel around £${capTypical}/yr with policy shifts worth tracking before you fix a tariff.\n\nStanding charges and direct-debit realignment are the immediate levers before locking a fixed tariff.\n\nUse the link below to check your supplier statement matches cap rates before you switch.`,
      },
      solar: {
        gbp: 450,
        headlines: [
          `check if your export tariff pays the full smart export guarantee rate`,
          `an MCS certificate is what actually unlocks solar payments`,
          `some suppliers pay over 30p per kWh exported — most pay far less`,
          `not every solar tariff is open to everyone — check the small print`,
          `size the panels to your roof and daytime use, not a generic kit`,
        ],
        prose: `Every UK electricity supplier with over 150,000 customers must offer a Smart Export Guarantee (SEG) tariff, paying you for solar electricity you export to the grid — but rates vary hugely: as of March 2026 there were 50 tariffs across 11 suppliers, and only 21 were open to every household with no conditions attached.\n\nYou need a smart meter and a valid MCS or Flexi-Orb certificate to get paid at all — without that paperwork, exported electricity earns you nothing no matter how much you generate.\n\nUse the link below for Ofgem's current SEG guidance, then compare live rates before you sign an install quote.`,
      },
      travel: {
        gbp: 450,
        headlines: [
          `swap one weekly car commute for rail`,
          `one fewer car trip a week pays off fast`,
          `check the season ticket price before you fuel up again`,
          `rail beats ad-hoc fuel top-ups on the same route`,
          `a single weekly swap trims the commute bill`,
        ],
        prose: `Around ${areaLabel}, one regular car commute is often the priciest habit on your travel row — a single rail or bus day each week is a gentle first swap.\n\nLocal timetables and season tickets still beat ad-hoc fuel top-ups when you plan the same journey twice.\n\nUse the link below to check rail or bus options for your usual route before you renew insurance or fuel cards.`,
      },
      holidays: {
        gbp: 250,
        headlines: [
          `cut flights with more local rail trips`,
          `one less return flight a year adds up fast`,
          `rail over short-haul flights on the same break`,
          `compare the train before you book the flight`,
          `fewer flights, same breaks, lower bill`,
        ],
        prose: `Holidays from ${areaLabel} carry a heavy footprint — fewer flights and rail over short hops cuts both kg and spend.\n\nOne less return flight a year often saves hundreds before airline surcharges climb again.\n\nUse the link below to compare flight vs rail for your next break before you book.`,
      },
      food: {
        gbp: 180,
        headlines: [
          `too good to go turns unsold shop food into £2-4 bags`,
          `olio lets neighbours give away food for free before it's binned`,
          `6.6 million people already use too good to go across the UK`,
          `stop binning what a neighbour would take for free`,
          `check what's left near you before the shop closes`,
        ],
        prose: `Too Good To Go lets shops, cafes and restaurants near ${areaLabel} sell surplus food as a "magic bag" at roughly a third of the shelf price — 6.6 million people in the UK already use it.\n\nOlio works differently: it's a free neighbour-to-neighbour network for giving away food (and other items) that would otherwise be binned, with no payment involved either way.\n\nUse the link below to see what's listed near you today.`,
      },
      shopping: {
        gbp: 110,
        headlines: [
          `the restart project runs free repair events for broken electronics`,
          `over 130 volunteer repair cafes now operate across the UK`,
          `second-hand first on vinted beats fast fashion for less`,
          `bring a broken toaster or laptop to a repair cafe before you bin it`,
          `check for a nearby repair event before you order a replacement`,
        ],
        prose: `The Restart Project and the wider UK community repair network run free, volunteer-led events — over 130 groups nationwide will look at a broken laptop, phone, or small appliance before you throw it out.\n\nFor clothes specifically, second-hand marketplaces like Vinted routinely beat new fast-fashion prices without the churn.\n\nUse the link below to find textile recycling and reuse guidance, or search for your nearest repair cafe.`,
      },
      money: {
        gbp: 320,
        headlines: [
          `triodos won best ethical financial provider at the 2026 british bank awards`,
          `some banks still fund fossil fuels with your savings — some don't`,
          `an ethical ISA doesn't have to mean giving up the rate`,
          `check where your savings are actually invested`,
          `triodos excludes fossil fuels entirely from its stocks and shares ISA`,
        ],
        prose: `Triodos Bank was named Best Ethical Financial Provider at the 2026 British Bank Awards, and is the only major UK provider to fully exclude fossil fuels from its Stocks & Shares ISA.\n\nIt's digital-only and doesn't offer mortgages or credit cards like a high-street bank, so it suits savings and ISAs specifically rather than being an all-in-one switch.\n\nUse the link below to compare Triodos's current ISA rates against what you're earning now.`,
      },
      tech: {
        gbp: 140,
        headlines: [
          `restart project volunteers fix electronics free at UK repair events`,
          `most device failures are one fixable part, not a dead unit`,
          `a smart meter ends estimated bills for good`,
          `check your right to spare parts before you replace a device`,
          `free electronics repair events run most months near you`,
        ],
        prose: `The Restart Project's UK repair network fixes broken laptops, phones, and small electronics for free at community events — most failures turn out to be a single replaceable part, not the whole device.\n\nSeparately, a smart meter (free from your supplier) ends estimated billing and shows real-time usage, which is what actually catches a phantom-draining appliance rather than guessing.\n\nUse the link below to compare refurbished devices, or search for a repair event near you.`,
      },
      water: {
        gbp: 90,
        headlines: [
          `WaterSure caps your bill if you're on a meter and get certain benefits`,
          `three or more kids or a medical condition can qualify you for WaterSure`,
          `you can't claim WaterSure without being on a meter first`,
          `check if your household qualifies for a capped water bill`,
          `a capped bill beats a rising metered one if you're eligible`,
        ],
        prose: `WaterSure caps your water bill at your company's average metered bill if you're on a water meter, receive a qualifying benefit (Universal Credit, Pension Credit, Housing Benefit and others), and either have three or more children under 19 or a medical condition that means you use significantly more water.\n\nYou have to already be on a meter, or have applied for one, to qualify — unmetered households can't claim it.\n\nUse the link below for the full eligibility list and how to apply through your water company.`,
      },
      waste: {
        gbp: 70,
        headlines: [
          `TerraCycle takes what your council bin won't — crisp packets, batteries`,
          `Freegle has 4 million UK members giving things away instead of binning them`,
          `450+ local Freegle groups mean someone nearby probably wants your junk`,
          `most TerraCycle recycling programmes are free, funded by the brands themselves`,
          `check what your council can't recycle kerbside before you bin it`,
        ],
        prose: `TerraCycle runs free recycling programmes for things your council collection won't take — crisp packets, toothpaste tubes, batteries, and other "hard to recycle" packaging — funded by the brands themselves, so there's no cost to you.\n\nFreegle is different: a free give-and-get network with 4 million UK members across 450+ local groups, built specifically to keep usable items out of landfill.\n\nUse the link below to find a TerraCycle drop-off point, or list something on Freegle instead of binning it.`,
      },
      carbon: {
        gbp: 100,
        headlines: [
          `WWF's free footprint calculator shows where your household stands`,
          `a 10-minute questionnaire beats guessing at your carbon footprint`,
          `see your footprint against the UK average before you buy an offset`,
          `WWF's calculator splits your footprint into four real categories`,
          `track it before you offset it — WWF's tool is free`,
        ],
        prose: `WWF's Footprint Calculator is a free, UK-specific questionnaire that estimates your household's carbon footprint across four categories — home energy, travel, food, and stuff you buy — and shows concrete ways to cut each one.\n\nIt takes about ten minutes, with no account or payment needed, unlike some newer carbon-tracking apps.\n\nUse the link below to run it before you consider paying for offsets — cutting the footprint is usually cheaper than buying it back.`,
      },
    }

    const targetCat = cat || 'home'
    const journeyKey = normalizeCategoryToJourneyKey(targetCat)
    const fallback = fallbacks[targetCat] ?? fallbacks.home
    const prose = normalizeArchitectProseThreeParagraphs(fallback.prose)
    if (!prose) return null

    // Deterministic headline variety: same user/postcode/category/profile-shape picks the same
    // variant (consistent within a day/session) but different postcodes AND different profile
    // shapes at the same postcode spread across the pool. Previously this seed was postcode-only,
    // so every visitor to a given postcode saw the literally identical headline forever regardless
    // of what they'd answered — live-reported as "the same tip and offer all the time." home_type
    // and tenure are folded in here for that reason; still not full personalisation (the pool
    // itself is only 5 phrasings), but it's the fastest fix that stops two different profiles at
    // one postcode from being indistinguishable.
    const headlineSeed = `${params.postcode ?? ''}-${journeyKey}-${params.profileData?.home_type ?? ''}-${params.profileData?.tenure ?? ''}`
    const headline = deterministicPoolPick(fallback.headlines, headlineSeed)

    // Real per-user £ figure instead of the flat per-category constant, when profile data is
    // available and the category's calculation actually branches on fields we have (home_power,
    // transport_baseline, employment_status). Falls back to the flat constant whenever the
    // calculated result is 0/invalid, so this never breaks or shows a fake £0 to a user.
    //
    // Honest scoping — not every category can genuinely vary yet:
    //  - utilities, home: branch on home_power (energy_type) — real variation.
    //  - travel: branches on transport_baseline (primary_transport) — real variation.
    //  - water: branches on the wash_preference onboarding question (bath/shower/both) — real variation.
    //  - holidays: branches on the flight_frequency onboarding question (none/one_two/three_plus) — real variation.
    //  - money, food, shopping, tech, waste: their "formal" calculator fields (green_investments,
    //    tariff_type, diet_profile, retail_channel, smart_thermostat, composting…) were defined in
    //    lib/journeys.ts but never wired to any onboarding UI (confirmed — nothing in app/
    //    references them). The one real per-user signal that does exist is the post-close loop
    //    nudge for that category (money_smart_tariff, food_plant_shift, shopping_repair_first,
    //    tech_standby_off, waste_compost/food_waste_cut) — passed through when profileData carries
    //    it. Still only wired end-to-end for the client-side session stat and the answer-time
    //    spawn card; NOT yet persisted server-side, so a returning visit on another
    //    device/session won't reflect an old answer here until that's built.
    //    They still get `applyEmploymentFinancialPhysics`, a small (4–5%) but genuine adjustment.
    //  - solar, carbon: no per-user answer feeds their calculators at all (solar needs roof data,
    //    carbon needs footprint-tracking answers) — the flat constant stays untouched here on
    //    purpose rather than faking personalisation. Solar is additionally gated by tenure
    //    elsewhere (renters can't act on it) rather than needing its own onboarding question.
    //    Both now get live PVGIS/Carbon-Intensity data instead (see liveSolarYield/liveGrid below).
    let gbp = fallback.gbp
    if (params.profileData) {
      const pd = params.profileData
      const employment = normalizeEmploymentStatus(pd.employment_status ?? undefined)
      let calculatedMoneyGbp: number | null = null

      if (journeyKey === 'money') {
        // Previously passed home_power/energy_type/monthly_cost/green_tariff — none of which
        // calculateMoney reads (it reads green_investments/tariff_type/monthly_energy_bill), so
        // this branch silently computed the same flat baseline for every user regardless of
        // profile. money_smart_tariff (the "try a cheaper energy tariff?" loop nudge) is the
        // real live signal available now — see calculateMoney's tariff_loop handling.
        const answers: Record<string, string> = {
          money_smart_tariff: pd.money_smart_tariff ?? '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateMoney(answers),
          employment,
          'money'
        ).moneyGbp
      } else if (journeyKey === 'utilities') {
        const answers: Record<string, string> = {
          home_power: pd.home_power ?? '',
          energy_type: pd.home_power ?? '',
          monthly_cost: '',
          green_tariff: '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateUtilities(answers, params.liveRates ?? undefined),
          employment,
          'utilities'
        ).moneyGbp
      } else if (journeyKey === 'home') {
        const answers: Record<string, string> = {
          home_power: pd.home_power ?? '',
          energy_type: pd.home_power ?? '',
          monthly_cost: '',
          green_tariff: '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateHome(answers, params.liveRates ?? undefined),
          employment,
          'home'
        ).moneyGbp
      } else if (journeyKey === 'travel') {
        const answers: Record<string, string> = {
          primary_transport: pd.transport_baseline ?? '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateTravel(answers, pd.transport_baseline ?? undefined),
          employment,
          'travel'
        ).moneyGbp
      } else if (journeyKey === 'water') {
        const answers: Record<string, string> = {
          wash_preference: pd.wash_preference ?? '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateWater(answers),
          employment,
          'water'
        ).moneyGbp
      } else if (journeyKey === 'holidays') {
        const answers: Record<string, string> = {
          annual_flights: pd.flight_frequency ?? '',
        }
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(
          calculateHolidays(answers),
          employment,
          'holidays'
        ).moneyGbp
      } else if (
        journeyKey === 'food' ||
        journeyKey === 'shopping' ||
        journeyKey === 'tech' ||
        journeyKey === 'waste'
      ) {
        // These four have no dedicated onboarding question (diet_profile/retail_channel/
        // smart_thermostat/composting were scaffolded in lib/journeys.ts but never wired to any
        // UI — confirmed nothing in app/ references them). The post-close loop nudge for each
        // category is the only real per-user signal that exists — pass it through instead of {}.
        const baseResult =
          journeyKey === 'food'
            ? calculateFood({ food_plant_shift: pd.food_plant_shift ?? '' })
            : journeyKey === 'shopping'
              ? calculateShopping({ shopping_repair_first: pd.shopping_repair_first ?? '' })
              : journeyKey === 'tech'
                ? calculateTech({ tech_standby_off: pd.tech_standby_off ?? '' })
                : calculateWaste({
                    waste_compost: pd.waste_compost ?? '',
                    food_waste_cut: pd.food_waste_cut ?? '',
                  })
        calculatedMoneyGbp = applyEmploymentFinancialPhysics(baseResult, employment, journeyKey).moneyGbp
      }

      // A calculated £0 usually means "no input data" (treat as missing, keep the flat constant
      // below rather than show a fake £0) — except holidays, where "NONE" flights is a real,
      // deliberately-answered £0 that should override the flat constant rather than be discarded.
      const zeroIsMeaningful = journeyKey === 'holidays' && (pd.flight_frequency ?? '').trim() !== ''
      if (
        calculatedMoneyGbp != null &&
        Number.isFinite(calculatedMoneyGbp) &&
        (calculatedMoneyGbp > 0 || zeroIsMeaningful)
      ) {
        gbp = Math.round(calculatedMoneyGbp)
      }
    }

    // The prose template above quotes an illustrative "~£<fallback.gbp>/yr" figure written
    // against the flat constant. When the block above swaps in a real per-user calculateXxx()
    // figure, that quoted number goes stale (e.g. prose still says "~£90/yr" while the stat
    // badge shows £180) — an internal contradiction on the same card. Re-point the prose at the
    // real number whenever the two diverge, rather than leaving the old flat figure in the copy.
    const proseForDisplay =
      gbp !== fallback.gbp
        ? prose.replace(new RegExp(`£${fallback.gbp}(?=/yr)`, 'g'), `£${gbp}`)
        : prose

    // HOME's default fallback above assumes a house with a loft ("seal draughts and loft
    // gaps") — wrong for a flat, and wrong for renters/Scotland/NI where the Boiler Upgrade
    // Scheme quoted in the generic prose doesn't apply. Reuse the same tenure/country scheme
    // router already wired into the loop-question path (homeHeatingSchemeForUser /
    // researchLocalGrants.ts) so the MOTHER card — the one every visitor sees first, before
    // any loop question — carries the same real personalisation instead of generic filler.
    if (journeyKey === 'home') {
      const tenure = params.profileData?.tenure ?? null
      const homeType = (params.profileData?.home_type ?? '').toUpperCase()
      const country = ukCountryFromPostcode(params.postcode)
      const isRenter = (tenure ?? '').toUpperCase().includes('RENT')
      const isFlat = homeType === 'FLAT'

      if (country !== 'england-wales' || isRenter) {
        const scheme = homeHeatingSchemeForUser({ postcode: params.postcode, tenure })
        return {
          saving_amount_gbp: gbp,
          agent_headline: clampZoneBentoHeadline(
            scheme.headline.toLowerCase(),
            journeyKey,
            JOURNEY_CARD_HEADLINE_BOUNDS
          ),
          architect_prose: normalizeArchitectProseThreeParagraphs(scheme.body) ?? proseForDisplay,
          offer_url: scheme.learnUrl,
          category: journeyKey,
        }
      }

      if (isFlat) {
        const flatHeadlines = [
          `draught-strip your windows and doors first`,
          `a smart thermostat pays back fastest in a flat`,
          `radiator reflector foil is the cheap flat-dweller's win`,
          `check your TRVs before you touch anything else`,
          `block the letterbox and gaps under doors first`,
        ]
        const flatHeadline = deterministicPoolPick(flatHeadlines, headlineSeed)
        const flatProse = normalizeArchitectProseThreeParagraphs(
          `Flats in ${areaLabel} don't have a loft to seal, so the biggest cheap win is draughts — windows, doors, letterboxes, and gaps around pipework.\n\nJuly 2026 bills still track the energy price cap (~£${capTypical}/yr typical dual-fuel), so sealing draughts and fitting reflector foil behind radiators on external walls both pay back within a season.\n\nUse the link below for a room-by-room draught-proofing checklist.`
        )
        if (flatProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(flatHeadline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS),
            architect_prose: flatProse,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    // WATER's default fallback above assumes a shower-only household. A bath-heavy household's
    // single biggest lever (a bath is ~80L vs ~35L for a shower) is completely different advice
    // from a shower-only household's (flow-rate, not habit) — reuse the wash_preference answer
    // already collected for the £ figure above so the mother card matches what was actually
    // asked, not a generic "fix your water use" template.
    if (journeyKey === 'water') {
      const wash = (params.profileData?.wash_preference ?? '').toUpperCase()
      if (wash === 'BATH') {
        const bathHeadlines = [
          `swap two baths a week for showers`,
          `a bath uses more than double a shower's water`,
          `keep some baths, add showers for the rest of the week`,
          `baths are the biggest lever on your water bill`,
          `cut one bath a week before you touch anything else`,
        ]
        const bathProse = normalizeArchitectProseThreeParagraphs(
          `A standard bath uses around 80 litres; an ordinary shower uses roughly 35 — so trading even two baths a week for showers is the single biggest lever on a bath-heavy household's water bill in ${areaLabel}.\n\nIf you're on a water meter and receive a qualifying benefit, WaterSure caps your bill regardless of how many baths you run — worth checking before you change any habits at all.\n\nUse the link below to check WaterSure eligibility, or compare low-flow shower heads if the baths are staying.`
        )
        if (bathProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(bathHeadlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: bathProse,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
      if (wash === 'SHOWER') {
        const showerHeadlines = [
          `a flow-limited shower head cuts water without cutting pressure`,
          `showers already beat baths — an aerator trims it further`,
          `check your shower's litres-per-minute before anything else`,
          `a shorter shower habit saves more than switching products`,
          `you're already ahead on baths — the aerator is next`,
        ]
        const showerProse = normalizeArchitectProseThreeParagraphs(
          `Showering already uses roughly half what a bath does, so the next lever for a shower household in ${areaLabel} is flow rate, not habit — a flow-limited aerator head cuts litres per minute without a noticeable pressure drop.\n\nIf you're on a water meter and receive a qualifying benefit, WaterSure caps your bill outright regardless of shower length — worth checking even though you're already using less than a bath-heavy household.\n\nUse the link below for WaterSure eligibility, or to compare low-flow shower heads.`
        )
        if (showerProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(showerHeadlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: showerProse,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
      if (wash === 'BOTH') {
        const bothHeadlines = [
          `mix of baths and showers? the aerator still pays off first`,
          `keep some baths, cut the rest with a flow-limited head`,
          `a household split between baths and showers has one easy lever`,
          `the aerator works whichever way you wash`,
          `trim the bath half of the week before anything else`,
        ]
        const bothProse = normalizeArchitectProseThreeParagraphs(
          `Splitting the week between baths and showers still leaves one easy lever: a flow-limited shower head cuts litres on shower days, and trading one or two baths a week for a shower does the rest.\n\nIf you're on a water meter and receive a qualifying benefit, WaterSure caps your bill regardless of which you choose most weeks — worth checking either way.\n\nUse the link below for WaterSure eligibility, or to compare low-flow shower heads.`
        )
        if (bothProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(bothHeadlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: bothProse,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    // TRAVEL's default fallback above assumes a car commuter — telling someone who already
    // walks, cycles, or takes the bus/train to "swap to rail" is nonsensical and was the exact
    // kind of profile-blind advice flagged as broken. CAR and MIX (and unknown) still fall
    // through to the car-commuter default below, which is the profile it was actually written for.
    if (journeyKey === 'travel') {
      const mode = (params.profileData?.transport_baseline ?? '').toUpperCase()
      /* Onboarding's transport enum is WALK/BIKE/PUBLIC/CAR/MIX (app/profile/ProfilePageClient.tsx)
         — there is no 'BUS'/'TRAIN' value anywhere, so this branch was dead: every public-transport
         user fell through to the car-commuter default, the exact "profile-blind advice" this
         whole section exists to avoid. */
      if (mode === 'PUBLIC') {
        const publicHeadlines = [
          `you're already off the road — a railcard trims the fare further`,
          `stack a railcard with off-peak timing on your route`,
          `split-ticketing beats a single point-to-point fare`,
          `check which railcard fits your commute before you renew`,
          `off-peak and split tickets are the next lever on an already-good commute`,
        ]
        const publicProse = normalizeArchitectProseThreeParagraphs(
          `You're already commuting by bus or train — the swap most travel advice pushes people toward — so the next lever is squeezing the fare itself. A Railcard (Two Together, 16-25, 26-30, or Senior) knocks a third off many off-peak fares and stacks with most ticket types.\n\nSplit-ticketing — buying separate tickets for legs of the same journey instead of one point-to-point fare — regularly beats the single-ticket price on longer routes without changing trains.\n\nUse the link below to check which railcard applies to your route.`
        )
        if (publicProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(publicHeadlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: publicProse,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
      if (mode === 'BIKE' || mode === 'WALK') {
        const activeHeadlines = [
          `walking or cycling already beats every other commute option`,
          `a Cycle to Work scheme covers a new bike tax-free`,
          `keep the bike roadworthy — that's the real lever now`,
          `you've already made the best travel swap there is`,
          `the only upgrade left on an active commute is the kit`,
        ]
        const activeProse = normalizeArchitectProseThreeParagraphs(
          `Walking or cycling is already the cheapest and lowest-carbon way to commute — there's no swap to make here, so the "switch to rail" advice that fits every other travel profile doesn't apply to you.\n\nIf you don't already have a bike, the Cycle to Work scheme lets you buy one tax-free through salary sacrifice, cutting the upfront cost by roughly 20-42% depending on your tax band, with no spending cap and e-bikes included.\n\nUse the link below for current Cycle to Work terms, or to compare bikes if you're starting from scratch.`
        )
        if (activeProse) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(activeHeadlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: activeProse,
            offer_url: 'https://www.cyclescheme.co.uk',
            category: journeyKey,
          }
        }
      }
    }

    // SOLAR and CARBON previously had no profile/live data feeding them at all (flat national
    // constant only — see the "honest scoping" note above calculatedMoneyGbp). Both now have a
    // real free live source: PVGIS gives an actual postcode-level solar yield instead of a
    // national guess, and NESO Carbon Intensity gives a real today's-grid figure instead of
    // static prose. Both stay optional and defensive — no live data means the flat constant and
    // generic prose from the fallbacks table above are used unchanged.
    if (journeyKey === 'solar' && params.liveSolarYield && params.liveSolarYield.annualKwhEstimate > 0) {
      const yieldKwh = Math.round(params.liveSolarYield.annualKwhEstimate)
      const scaledGbp = Math.max(150, Math.round(gbp * params.liveSolarYield.yieldFactor))
      const solarHeadlines = [
        `a 4kWp system on your roof could generate ~${yieldKwh} kWh a year`,
        `your postcode gets a real solar yield, not a national average`,
        `check what your roof would actually generate before you quote`,
        `your postcode's solar yield beats a generic UK estimate`,
        `~${yieldKwh} kWh a year is what a typical system would produce here`,
      ]
      const solarProse = normalizeArchitectProseThreeParagraphs(
        `Based on EU Commission solar irradiance data for your postcode, a typical 4kWp system in ${areaLabel} would generate roughly ${yieldKwh} kWh a year — a real figure for your latitude and local cloud cover, not a flat UK-wide average.\n\nEvery UK electricity supplier with over 150,000 customers must offer a Smart Export Guarantee (SEG) tariff paying for what you export, but you need a smart meter and a valid MCS or Flexi-Orb certificate to get paid at all.\n\nUse the link below for Ofgem's current SEG guidance, then compare live rates before you sign an install quote.`
      )
      if (solarProse) {
        return {
          saving_amount_gbp: scaledGbp,
          agent_headline: clampZoneBentoHeadline(
            deterministicPoolPick(solarHeadlines, headlineSeed),
            journeyKey,
            JOURNEY_CARD_HEADLINE_BOUNDS
          ),
          architect_prose: solarProse,
          offer_url: trustedUrlForJourney(journeyKey),
          category: journeyKey,
        }
      }
    }

    if (journeyKey === 'carbon' && params.liveGrid && params.liveGrid.intensityGPerKwh != null) {
      const intensity = Math.round(params.liveGrid.intensityGPerKwh)
      const band =
        (params.liveGrid.index || '').toLowerCase() ||
        (intensity < 100 ? 'low' : intensity < 200 ? 'moderate' : 'high')
      const renewables =
        params.liveGrid.renewablesPercent != null ? Math.round(params.liveGrid.renewablesPercent) : null
      const carbonHeadlines = [
        `right now the UK grid is ${band} carbon at ${intensity}g CO2 per kWh`,
        `today's grid is ${band} — a good time to check your footprint`,
        renewables != null
          ? `${renewables}% renewables on the grid right now`
          : `see where today's grid stands before you check your footprint`,
        `grid carbon shifts hour to hour — see today's number first`,
        `${intensity}g CO2/kWh right now — WWF's calculator shows your yearly total`,
      ]
      const renewablesLine =
        renewables != null
          ? ` Renewables currently make up roughly ${renewables}% of generation.`
          : ''
      const carbonProse = normalizeArchitectProseThreeParagraphs(
        `Right now the GB electricity grid is running at approximately ${intensity}g CO2 per kWh — NESO's live Carbon Intensity index rates that as "${band}."${renewablesLine} This number moves hour to hour with wind, sun, and demand, so the same appliance run at 3am can be genuinely cleaner than at 6pm.\n\nWWF's free Footprint Calculator turns that into a full household estimate — home energy, travel, food, and stuff you buy — in about ten minutes, no account needed.\n\nUse the link below to run it, then time flexible electricity use (EV charging, washing, dishwashing) around the greener hours when you can.`
      )
      if (carbonProse) {
        return {
          saving_amount_gbp: gbp,
          agent_headline: clampZoneBentoHeadline(
            deterministicPoolPick(carbonHeadlines, headlineSeed),
            journeyKey,
            JOURNEY_CARD_HEADLINE_BOUNDS
          ),
          architect_prose: carbonProse,
          offer_url: trustedUrlForJourney(journeyKey),
          category: journeyKey,
        }
      }
    }

    // FOOD/SHOPPING/TECH/WASTE/MONEY have no onboarding question of their own (see the "Honest
    // scoping" note above) — the post-close loop nudge is the only real per-user signal. Each
    // branch below only fires when that specific answer is present; anyone who hasn't answered
    // (the vast majority, since this is a nudge shown after closing the card, not an onboarding
    // step) falls through to the existing generic-but-real pool content unchanged.
    if (journeyKey === 'food') {
      const plantShift = (params.profileData?.food_plant_shift ?? '').toUpperCase()
      if (plantShift.includes('YES')) {
        const headlines = [
          `keep the plant swaps going — batch cook to make it stick`,
          `two meals in, now build a rotation you can repeat`,
          `plant-based twice a week? plan the other five too`,
          `you're already swapping — batch cooking locks it in`,
          `next step after the swap: a repeatable meal list`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You've already started swapping in plant-based meals — the habit that actually sticks from here is a short rotation of 4-5 meals you repeat, not a new recipe every week.\n\nBatch cooking one or two of those in bulk and freezing portions cuts both cooking time and the temptation to order in on a tired evening.\n\nUse the link below for Too Good To Go's surplus bags if you want to build the rotation around whatever's discounted that day.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    if (journeyKey === 'shopping') {
      const repairFirst = (params.profileData?.shopping_repair_first ?? '').toUpperCase()
      if (repairFirst.includes('YES')) {
        const headlines = [
          `you said repair first — here's where to actually take it`,
          `repair cafes do this for free, no appointment needed`,
          `broken doesn't mean bin it — find your nearest repair event`,
          `you're already repair-first — the network exists near you`,
          `most breaks are one part — a repair cafe checks first`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You've said you'd rather repair than replace — the UK's volunteer repair cafe network (over 130 groups, run through The Restart Project) does exactly this for free: bring a broken toaster, lamp, or laptop and a volunteer will look at it before you write it off.\n\nMost electrical failures turn out to be one replaceable part, not the whole device — worth a look even if you're not confident fixing it yourself.\n\nUse the link below to find a repair event near you, or Vinted if what's broken is actually beyond saving.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: 'https://therestartproject.org/',
            category: journeyKey,
          }
        }
      }
    }

    if (journeyKey === 'tech') {
      const standbyOff = (params.profileData?.tech_standby_off ?? '').toUpperCase()
      if (standbyOff.includes('YES')) {
        const headlines = [
          `standby's handled — a smart plug automates the rest`,
          `you're already switching off — a timer plug does it for you`,
          `next lever after standby: automate it so it's not a habit`,
          `you've got the habit — a smart plug removes the need for it`,
          `standby sorted — check what's still drawing power overnight`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You're already turning things off at night — a cheap smart plug or timer on the TV, router, or games console does the same job automatically, so it stops depending on remembering.\n\nA free smart meter (ordered through your supplier) shows exactly what's still drawing power overnight once the obvious stuff is handled — often something unexpected like a printer or a second router.\n\nUse the link below to compare refurbished devices if anything's due for replacement anyway.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    if (journeyKey === 'waste') {
      const compost = (params.profileData?.waste_compost ?? '').toUpperCase()
      if (compost.includes('YES')) {
        const headlines = [
          `composting already? check if your council collects garden waste too`,
          `you're composting — see what else your bin won't take kerbside`,
          `next step after composting: TerraCycle for the stuff bins can't take`,
          `composting sorted — batteries and crisp packets need a different route`,
          `you've got composting down — widen it to hard-to-recycle items`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You're already composting food scraps, which handles the biggest single lever — wet organic waste in landfill releases methane at 25 times the warming impact of CO2 over a century.\n\nThe next gap is usually "hard to recycle" packaging your council bin won't take at all — crisp packets, toothpaste tubes, batteries — which TerraCycle collects for free, funded by the brands themselves.\n\nUse the link below to find a TerraCycle drop-off point, or Freegle if something's still usable rather than waste.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    if (journeyKey === 'money') {
      const smartTariff = (params.profileData?.money_smart_tariff ?? '').toUpperCase()
      if (smartTariff.includes('YES') || smartTariff.includes('COMPARE')) {
        const headlines = [
          `you're ready to switch — compare tariffs before your renewal date`,
          `switching interest noted — check your exit fees first`,
          `before you switch, confirm your current tariff's end date`,
          `ready to compare? your renewal date decides the best timing`,
          `switching tariff? time it against your fixed-term end date`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You've said you're open to a cheaper tariff — the main thing that decides whether it's worth doing now is your current deal's end date. Switching mid-fixed-term can carry an exit fee that eats the saving.\n\nOnce you're inside the last few weeks of a fixed term (or already on a variable/default tariff), comparison sites show genuine savings against the July 2026 price cap.\n\nUse the link below for a Triodos savings comparison if the cash you free up needs somewhere to sit in the meantime.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    // HOLIDAYS: flight_frequency is a real onboarding answer (unlike the loop-nudge-only
    // categories above) — someone who said they don't fly gets told to stop flying by the
    // generic pool above, which is a live example of the exact profile-blind pattern this whole
    // pass exists to fix. THREE_PLUS gets a different lever too (frequent flyers rarely respond
    // to "fly less"; booking/class choice is the more useful angle for that group specifically).
    if (journeyKey === 'holidays') {
      const flights = (params.profileData?.flight_frequency ?? '').toUpperCase()
      if (flights === 'NONE') {
        const headlines = [
          `you already don't fly — rail breaks keep it that way`,
          `no flights this year already puts you ahead — plan the next trip by train`,
          `staying off flights? here's where to book the next rail trip`,
          `you're already in the lowest-carbon holiday bracket`,
          `no-fly year sorted — Eurostar covers most of Europe anyway`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `You've told us you're not flying this year, which already puts your holiday footprint in the lowest UK bracket — the generic "cut a flight" advice most people get doesn't apply to you.\n\nEurostar and the wider European rail network cover most short-to-medium trips from the UK without ever needing an airport, often for a comparable price when booked 8-12 weeks ahead.\n\nUse the link below for current Eurostar deals if you're planning the next trip.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      } else if (flights === 'THREE_PLUS') {
        const headlines = [
          `flying three or more times a year? booking timing matters most`,
          `frequent flyer? economy over business cuts your share ~3x`,
          `three-plus flights a year — the lever is class and booking, not stopping`,
          `flying often? seat count decides your per-passenger carbon`,
          `for frequent flyers, how you book beats whether you fly`,
        ]
        const prose = normalizeArchitectProseThreeParagraphs(
          `Flying three or more times a year puts you in a different bracket to most UK households, so "fly less" is less useful advice than how you book — economy class over business cuts your per-seat carbon share by roughly three times on the same flight, since the total aircraft emissions get split by seat space, not passenger count.\n\nBooking 8-12 weeks ahead and flying direct where possible also trims both cost and the extra emissions from layovers.\n\nUse the link below to compare rail for any of those trips that are actually within reach of Eurostar.`
        )
        if (prose) {
          return {
            saving_amount_gbp: gbp,
            agent_headline: clampZoneBentoHeadline(
              deterministicPoolPick(headlines, headlineSeed),
              journeyKey,
              JOURNEY_CARD_HEADLINE_BOUNDS
            ),
            architect_prose: prose,
            offer_url: trustedUrlForJourney(journeyKey),
            category: journeyKey,
          }
        }
      }
    }

    // Locality-aware headline always wins here — we're already inside the branch that has a
    // real area label. ZONE_BENTO_HOOK (fully generic, no locality) is only for when there's none.
    return {
      saving_amount_gbp: gbp,
      agent_headline: clampZoneBentoHeadline(headline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS),
      architect_prose: proseForDisplay,
      offer_url: trustedUrlForJourney(journeyKey),
      category: journeyKey,
    }
  }

  const url = (params.offerUrl ?? '').trim()
  if (!url.startsWith('http')) return null
  if (!cat) {
    if (url.includes('ofgem') && /price-cap|energy-advice/i.test(url)) cat = 'bills'
    else return null
  }

  if (url.includes('ofgem') && /price-cap|energy-advice/i.test(url)) {
    const gbp = TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP
    const agent_headline =
      zoneCardHeadlineFromRaw(
        `compare your household tariff before you fix a deal`,
        `compare your household tariff before you fix a deal`,
        MAX_JOURNEY_CARD_HEADLINE_WORDS
      ) || `compare your household tariff before you fix a deal`
    const architect_prose =
      normalizeArchitectProseThreeParagraphs(
        `${areaLabel} sits under the July 2026 price-cap frame — typical dual-fuel around £${TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP}/yr with policy shifts worth tracking before you fix a tariff.\n\nGreen-levy movement and standing-charge maths matter more than generic comparison-site copy — align your direct debit and tariff end date to the cap window.\n\nUse the link below to check your supplier statement matches the cap period before you switch.`
      ) ?? ''
    if (!architect_prose) return null
    return {
      saving_amount_gbp: gbp,
      agent_headline: clampZoneBentoHeadline(agent_headline, 'utilities', JOURNEY_CARD_HEADLINE_BOUNDS),
      architect_prose,
      offer_url: trustedUrlForJourney('utilities'),
      category: 'utilities',
    }
  }

  return null
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
 * Hybrid pipeline — locked £ in markdown; prose via `generateResearchText` (bucket → Groq when configured).
 */
export async function extractHybridEditorialTriplet(params: {
  markdown: string
  postcode: string
  profileData?: ResearchProfileData | null
  category: string
  lockedSavingGbp: number
}): Promise<{
  agent_headline: string
  architect_prose: string
  offer_url: string
} | null> {
  const locked = Math.max(0, Math.round(params.lockedSavingGbp))
  const anchored = `${params.markdown.trim()}\n\nLOCKED saving_amount_gbp: ${locked} (do not change).`
  const triplet = await extractResearchTripletWithGemini(anchored, params.postcode, params.profileData, {
    categoryHint: params.category,
  })
  if (!triplet?.architect_prose) return null
  const prose = normalizeArchitectProseThreeParagraphs(triplet.architect_prose)
  if (!prose) return null
  return {
    agent_headline:
      normalizeGeminiAgentHeadline(triplet.agent_headline) ??
      triplet.agent_headline ??
      'shift your spend this year',
    architect_prose: prose,
    offer_url: triplet.offer_url?.trim().startsWith('https')
      ? triplet.offer_url.trim()
      : trustedUrlForJourney(normalizeCategoryToJourneyKey(params.category)),
  }
}

const INTERNAL_PROVIDER_RE =
  /\b(?:awin|firecrawl|gemini|openai|anthropic|google\s+generative|vertex)\b/i

const FIRECRAWL_PROXY_URL_RE = /firecrawl\.dev|api\.firecrawl/i

function sanitizeResearchSourceUrl(url: string | null | undefined): string | null {
  const trimmed = typeof url === 'string' ? url.trim() : ''
  if (!trimmed.startsWith('http')) return null
  if (FIRECRAWL_PROXY_URL_RE.test(trimmed)) return null
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(trimmed)) return null
  if (/\.vercel\.app/i.test(trimmed)) return null
  return trimmed.slice(0, 2048)
}

function sanitizeResearchProviderName(
  raw: string | null | undefined,
  citations: ResearchCitation[]
): string | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (trimmed && !INTERNAL_PROVIDER_RE.test(trimmed)) {
    return trimmed.slice(0, 256)
  }
  for (const c of citations) {
    const name = typeof c.source_name === 'string' ? c.source_name.trim() : ''
    if (name && !INTERNAL_PROVIDER_RE.test(name)) return name.slice(0, 256)
    const url = typeof c.url === 'string' ? c.url.trim() : ''
    if (url.startsWith('http')) {
      try {
        const host = new URL(url).hostname.replace(/^www\./i, '')
        const brand = host.split('.')[0]
        if (brand && brand.length >= 3 && !INTERNAL_PROVIDER_RE.test(brand)) {
          return brand.charAt(0).toUpperCase() + brand.slice(1)
        }
      } catch {
        /* ignore */
      }
    }
  }
  return 'UK Government'
}

/**
 * Cost guard: true when a row for this (user|ownerless, category, postcode) already landed
 * recently — skip the expensive Firecrawl scrape + Gemini call entirely, not just the DB write.
 * Owned rows use a short window (just enough to absorb the page-load race between Zone
 * components); ownerless/seed rows use a long window since that content doesn't need to be
 * regenerated more than once a day and every re-scrape burns real Firecrawl/Gemini cost for
 * zero personalization benefit.
 */
export async function hasRecentResearchResult(
  userId: string | null | undefined,
  category: string | null | undefined,
  postcode: string | null | undefined
): Promise<boolean> {
  const uid = userId?.trim() || null
  const cat = normalizeResearchCategory(category)
  const pc = postcode?.trim() || null
  if (!cat || !pc) return false
  try {
    const pool = getDbPool()
    const result = uid
      ? await pool.query(
          `SELECT 1 FROM research_results
           WHERE user_id = $1::uuid AND category = $2 AND postcode = $3
             AND created_at > NOW() - INTERVAL '60 seconds'
           LIMIT 1`,
          [uid, cat, pc]
        )
      : await pool.query(
          `SELECT 1 FROM research_results
           WHERE user_id IS NULL AND category = $1 AND postcode = $2
             AND created_at > NOW() - INTERVAL '24 hours'
           LIMIT 1`,
          [cat, pc]
        )
    return result.rows.length > 0
  } catch {
    return false
  }
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
       ADD COLUMN IF NOT EXISTS carbon_impact_kg NUMERIC(12,2),
       ADD COLUMN IF NOT EXISTS is_mechanical_fallback BOOLEAN NOT NULL DEFAULT false,
       ADD COLUMN IF NOT EXISTS is_headline_mechanical_fallback BOOLEAN NOT NULL DEFAULT false`
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
    const providerNameRaw =
      params.providerName?.trim() ||
      (mergedCitations[0]?.source_name ? String(mergedCitations[0].source_name).trim() : null)
    const providerName = sanitizeResearchProviderName(providerNameRaw, mergedCitations)
    let mergedCategory =
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
    let mergedOffer = mergedOfferRaw?.slice(0, 2048) ?? null

    const explicitHttpSource =
      typeof params.sourceUrl === 'string' && params.sourceUrl.trim().startsWith('http')
        ? params.sourceUrl.trim().slice(0, 2048)
        : null
    let mergedSourceForDb =
      explicitHttpSource ??
      (citationFallback ? citationFallback.slice(0, 2048) : null) ??
      (mergedOffer?.startsWith('http') ? mergedOffer : null)

    let savingForDb = mergedSaving ?? null
    const verifiedForDb = savingForDb

    let mergedArchitectProse =
      normalizeArchitectProseThreeParagraphs(params.architectProse?.trim()) ??
      normalizeArchitectProseThreeParagraphs(markdownTriplet?.architect_prose?.trim()) ??
      normalizeArchitectProseThreeParagraphs(geminiTriplet?.architect_prose?.trim()) ??
      null

    const journeyKeyForHeadline = normalizeCategoryToJourneyKey(mergedCategory ?? 'home')
    let mergedAgentHeadline =
      normalizeGeminiAgentHeadline(params.agentHeadline ?? undefined, MAX_JOURNEY_CARD_HEADLINE_WORDS) ??
      normalizeGeminiAgentHeadline(markdownTriplet?.agent_headline, MAX_JOURNEY_CARD_HEADLINE_WORDS) ??
      normalizeGeminiAgentHeadline(geminiTriplet?.agent_headline, MAX_JOURNEY_CARD_HEADLINE_WORDS) ??
      null

    const headlineWordCount = mergedAgentHeadline
      ? mergedAgentHeadline.split(/\s+/).filter(Boolean).length
      : 0
    const tripletEmpty =
      (savingForDb == null || savingForDb <= 0) &&
      !mergedAgentHeadline &&
      !mergedArchitectProse
    const headlineMatchesKnownGenericHook =
      mergedAgentHeadline != null &&
      Object.values(ZONE_BENTO_HOOK).some(
        (hook) => hook != null && normalizeCardHeadlineKey(hook) === normalizeCardHeadlineKey(mergedAgentHeadline!)
      )
    // Near-miss tolerance: a genuine headline within HEADLINE_NEAR_MISS_TOLERANCE_WORDS of the
    // 9-word target is accepted as-is rather than fully discarded for the generic template — see
    // HEADLINE_MECHANICAL_FLOOR_WORDS above. Only headlines below that floor, or ones that already
    // match a known generic hook verbatim, still route through the mechanical overwrite.
    const needsMechanicalHeadline =
      headlineWordCount > 0 &&
      (headlineWordCount < HEADLINE_MECHANICAL_FLOOR_WORDS || headlineMatchesKnownGenericHook)
    // savingIsMechanicalFallback tracks specifically whether the £ figure came from the shared
    // per-category template rather than genuine research — that's the only thing gating the
    // scraped-overlay in buildScrapedFromResearchResults needs to know, so it stays scoped to
    // the £ only (never broadened — folding headline-only templating into it would make that
    // gate wrongly zero out a real, already-settled saving amount just because the headline
    // needed the template). headlineIsMechanicalFallback is the separate, honest signal for the
    // headline specifically: it was previously untracked, so a row with a 100% genuine £ and
    // prose but a too-short LLM headline got its headline silently replaced by the generic
    // per-category template text while the whole row still reported is_mechanical_fallback =
    // false — i.e. "real". Both flags must be checked to know a row is genuinely fully bespoke.
    let savingIsMechanicalFallback = false
    let headlineIsMechanicalFallback = false
    if ((tripletEmpty || needsMechanicalHeadline) && (mergedOffer || mergedCategory)) {
      // Only fetch live PVGIS/Carbon Intensity when this row is actually solar or carbon — every
      // other category ignores them, so skipping the extra network round-trip keeps the other 10
      // categories' latency unchanged. Both calls are already defensive (null on any failure).
      const [liveSolarYield, liveGrid] =
        journeyKeyForHeadline === 'solar' || journeyKeyForHeadline === 'carbon'
          ? await Promise.all([
              journeyKeyForHeadline === 'solar'
                ? resolveLiveSolarYieldForPostcode(params.postcode)
                : Promise.resolve(null),
              journeyKeyForHeadline === 'carbon' ? resolveLiveGridSnapshot() : Promise.resolve(null),
            ])
          : [null, null]
      const mechanical = mechanicalCategoryTripletFallback({
        category: mergedCategory,
        offerUrl: mergedOffer ?? trustedUrlForJourney(journeyKeyForHeadline),
        localityContext: params.localityContext ?? null,
        postcode: params.postcode ?? null,
        profileData: params.profileData ?? null,
        liveRates:
          typeof params.elecUnitRateGbpPerKwh === 'number' && typeof params.gasUnitRateGbpPerKwh === 'number'
            ? { elecGbpPerKwh: params.elecUnitRateGbpPerKwh, gasGbpPerKwh: params.gasUnitRateGbpPerKwh }
            : null,
        liveSolarYield,
        liveGrid,
      })
      if (mechanical) {
        if (savingForDb == null || savingForDb <= 0) {
          savingForDb = mechanical.saving_amount_gbp
          savingIsMechanicalFallback = true
        }
        mergedAgentHeadline = mechanical.agent_headline
        headlineIsMechanicalFallback = true
        if (!mergedArchitectProse) mergedArchitectProse = mechanical.architect_prose
        if (mechanical.offer_url) mergedOffer = mechanical.offer_url
        if (mechanical.category) mergedCategory = mechanical.category
      }
    }

    if (mergedAgentHeadline) {
      const headlineJourneyKey = normalizeCategoryToJourneyKey(mergedCategory ?? 'home')
      mergedAgentHeadline = clampZoneBentoHeadline(
        mergedAgentHeadline,
        headlineJourneyKey,
        headlineIsMechanicalFallback ? JOURNEY_CARD_HEADLINE_BOUNDS : JOURNEY_CARD_HEADLINE_BOUNDS_NEAR_MISS
      )
      // Clamp fell back to the fully generic per-journey hook (lost any locality reference) —
      // try deriving a real headline from the architect_prose first, since that reliably carries
      // the locality name even when the headline extraction itself was too short/low-quality.
      const genericHook = ZONE_BENTO_HOOK[headlineJourneyKey]
      const fellBackToGenericHook =
        genericHook != null &&
        normalizeCardHeadlineKey(mergedAgentHeadline) === normalizeCardHeadlineKey(genericHook)
      if (fellBackToGenericHook && mergedArchitectProse) {
        const fromProse = headlineFromArchitectProse(mergedArchitectProse, MAX_JOURNEY_CARD_HEADLINE_WORDS)
        if (fromProse) {
          mergedAgentHeadline = clampZoneBentoHeadline(fromProse, headlineJourneyKey, JOURNEY_CARD_HEADLINE_BOUNDS)
        }
      }
      // A second, independent way a headline ends up templated: this clamp can collapse straight
      // to ZONE_BENTO_HOOK on quality grounds even when mechanicalCategoryTripletFallback above
      // never ran (genuine £ + genuine prose, just a jargon-flagged or too-terse headline with no
      // usable sentence to recover from). Check what we ended up with — original clamp or the
      // prose-recovery attempt — not just the first pass, so a recovery that itself collapsed
      // again still gets flagged.
      if (
        !headlineIsMechanicalFallback &&
        genericHook != null &&
        normalizeCardHeadlineKey(mergedAgentHeadline) === normalizeCardHeadlineKey(genericHook)
      ) {
        headlineIsMechanicalFallback = true
      }
    }

    const journeyKeyFinal = normalizeCategoryToJourneyKey(mergedCategory ?? 'home')
    if (mergedOffer?.startsWith('http')) {
      const persisted = sanitizeZoneOfferUrlForPersist(mergedOffer, journeyKeyFinal)
      mergedOffer = persisted
    }
    if (mergedSourceForDb?.startsWith('http')) {
      const srcClean = sanitizeResearchSourceUrl(mergedSourceForDb)
      mergedSourceForDb = srcClean
        ? sanitizeZoneOfferUrl(srcClean, journeyKeyFinal)
        : null
    }

    const highImpact = params.isHighImpact === true
    const carbonKg =
      params.carbonImpactKg != null && Number.isFinite(params.carbonImpactKg)
        ? params.carbonImpactKg
        : null

    // De-dupe guard (backstop): the real cost-saving check runs in hasRecentResearchResult()
    // before any Firecrawl/Gemini work starts (see runTriggerResearchForCategory). This is the
    // last line of defense for any caller that writes via persistResearchResult directly.
    const dedupeUserId = params.userId?.trim() || null
    const dedupePostcode = params.postcode?.trim() || null
    if (mergedCategory && dedupePostcode) {
      const recent = dedupeUserId
        ? await pool.query(
            `SELECT 1 FROM research_results
             WHERE user_id = $1::uuid AND category = $2 AND postcode = $3
               AND created_at > NOW() - INTERVAL '30 seconds'
             LIMIT 1`,
            [dedupeUserId, mergedCategory, dedupePostcode]
          )
        : await pool.query(
            `SELECT 1 FROM research_results
             WHERE user_id IS NULL AND category = $1 AND postcode = $2
               AND created_at > NOW() - INTERVAL '30 seconds'
             LIMIT 1`,
            [mergedCategory, dedupePostcode]
          )
      if (recent.rows.length > 0) return
    }

    const insertResearchResultRow = (userIdForInsert: string | null) =>
      pool.query(
        `INSERT INTO research_results (
           user_id, postcode, profile_snapshot, markdown, citations,
           elec_unit_rate_gbp_per_kwh, gas_unit_rate_gbp_per_kwh, source_url,
           deep_link, verified_saving, category, offer_url, saving_amount_gbp, locality_context,
           provider_name, agent_headline, architect_prose, research_snapshot,
           is_high_impact, carbon_impact_kg, is_mechanical_fallback,
           is_headline_mechanical_fallback, created_at
         )
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14, $15, $16, $17, $18::jsonb, $19, $20::numeric, $21, $22, NOW())`,
        [
          userIdForInsert,
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
          savingIsMechanicalFallback,
          headlineIsMechanicalFallback,
        ]
      )

    try {
      await insertResearchResultRow(params.userId?.trim() || null)
    } catch (insertErr: unknown) {
      // User row was deleted (e.g. GDPR reset) between when this background job started and
      // when it tried to persist — fall back to a guest-scoped row instead of losing the work.
      const code = (insertErr as { code?: string } | null)?.code
      if (code === '23503' && params.userId?.trim()) {
        await insertResearchResultRow(null)
      } else {
        throw insertErr
      }
    }

    const stillIncomplete =
      (savingForDb == null || savingForDb <= 0) &&
      !mergedAgentHeadline &&
      !mergedArchitectProse
    if (stillIncomplete && workingMarkdown.trim().length > 80) {
      await repairResearchResultsMissingHeadlines({
        userId: params.userId,
        postcode: params.postcode,
        profileData: params.profileData ?? null,
        limit: 1,
      })
    }
  } catch (e) {
    console.warn('[researchAgent] persistResearchResult failed:', e)
  }
}

/**
 * DB-only mechanical seed — all 13 Zone wall journeys for a postcode (no dev server / Firecrawl).
 * Replaces any existing row per journey+postcode before insert.
 */
export async function seedMechanicalJourneysForPostcode(
  postcode: string
): Promise<{ seeded: number; journeys: string[]; failed: string[] }> {
  const pc = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 5) throw new Error('postcode required (e.g. SW1A1AA)')

  let locality: string | null = null
  try {
    const local = await getLocalData(pc)
    locality =
      local?.locality?.trim() ||
      local?.council?.trim() ||
      local?.region?.trim() ||
      null
  } catch {
    /* optional geocode */
  }

  // Fetched once for the whole postcode (not per-journey) — resolveLiveUnitRatesForPostcode
  // already tiers Neon research -> live pulse -> static reference itself, so this always
  // resolves to something; only home/utilities actually use it (see mechanicalCategoryTripletFallback).
  // liveSolarYield (PVGIS) and liveGrid (NESO Carbon Intensity) are the same free-tier, no-auth
  // pattern extended to solar/carbon — fetched once per postcode-seed run, defensive null on
  // any failure, only solar/carbon actually consume them.
  const [liveRates, liveSolarYield, liveGrid] = await Promise.all([
    resolveLiveUnitRatesForPostcode(pc).catch(() => null),
    resolveLiveSolarYieldForPostcode(pc),
    resolveLiveGridSnapshot(),
  ])

  const pool = getDbPool()
  const seeded: string[] = []
  const failed: string[] = []

  for (const journey of JOURNEY_IDS) {
    try {
      const mechanical = mechanicalCategoryTripletFallback({
        category: journey,
        offerUrl: trustedUrlForJourney(journey),
        localityContext: locality,
        postcode: pc,
        liveRates,
        liveSolarYield,
        liveGrid,
      })
      if (!mechanical) {
        failed.push(journey)
        continue
      }

      const journeyKey = normalizeCategoryToJourneyKey(mechanical.category)
      const headline = clampZoneBentoHeadline(mechanical.agent_headline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS)
      const offerUrl = sanitizeZoneOfferUrl(mechanical.offer_url, journeyKey)

      await pool.query(
        `DELETE FROM research_results
         WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
           AND LOWER(COALESCE(category, '')) = $2`,
        [pc, journey]
      )

      await pool.query(
        `INSERT INTO research_results (
           postcode, category, saving_amount_gbp, agent_headline, architect_prose,
           offer_url, source_url, markdown, citations, is_mechanical_fallback,
           is_headline_mechanical_fallback, locality_context
         ) VALUES ($1, $2, $3::numeric, $4, $5, $6, $7, $8, $9::jsonb, true, true, $10)`,
        [
          pc,
          journeyKey,
          mechanical.saving_amount_gbp,
          headline,
          mechanical.architect_prose,
          offerUrl,
          offerUrl,
          `# ${journeyKey} — mechanical 12k/1t seed\n\nPostcode ${pc}. Trusted journey URL and 8–10 word headline.`,
          JSON.stringify([
            {
              source_name: 'Zero Zero mechanical seed',
              url: offerUrl,
              snippet: `Mechanical seed for ${journeyKey}`,
            },
          ]),
          locality,
        ]
      )
      seeded.push(journeyKey)
    } catch (e) {
      console.warn(`[researchAgent] seed ${journey} failed:`, e)
      failed.push(journey)
    }
  }

  if (failed.length > 0) {
    console.warn(`[researchAgent] seed incomplete for ${pc}: ${failed.join(', ')}`)
  }

  return { seeded: seeded.length, journeys: seeded, failed }
}

/** Seed mechanical 13-journey wall for distinct user postcodes (Hermes / ops). */
export async function seedMechanicalJourneysForDistinctPostcodes(
  limit = 5
): Promise<{ postcodes: string[]; totalSeeded: number }> {
  const pool = getDbPool()
  const cap = Math.min(Math.max(limit, 1), 20)
  const r = await pool.query<{ pc: string }>(
    `SELECT DISTINCT REPLACE(UPPER(TRIM(postcode)), ' ', '') AS pc
     FROM users
     WHERE postcode IS NOT NULL
       AND length(REPLACE(UPPER(TRIM(postcode)), ' ', '')) >= 5
     ORDER BY pc
     LIMIT $1`,
    [cap]
  )
  const postcodes = r.rows.map((row) => row.pc).filter(Boolean)
  let totalSeeded = 0
  for (const pc of postcodes) {
    const { seeded } = await seedMechanicalJourneysForPostcode(pc)
    totalSeeded += seeded
  }
  return { postcodes, totalSeeded }
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

  // Cost guard: skip the Firecrawl scrape + Gemini call entirely when a recent row already
  // covers this (user|ownerless, category, postcode) — checked before any paid API work starts.
  if (await hasRecentResearchResult(params.userId, cat, pc)) {
    return { markdown: '', citations: [] }
  }

  const journeyKey = resolveSurgicalJourneyKey(cat) ?? normalizeCategoryToJourneyKey(cat)
  const local = await getLocalData(pc).catch(() => null)
  const localityContext = local
    ? [local.locality, local.council, local.region].filter(Boolean).join(', ')
    : null

  const homePower =
    params.profileData?.home_power?.trim() ||
    readHomePowerFromGenome(
      (params.profileData as { user_genome?: Record<string, unknown> } | null)?.user_genome ?? null
    )

  const laneLock = buildLaneLockPromptBlock(journeyKey, {
    employment_status: params.profileData?.employment_status,
    household_income_bracket: params.profileData?.household_income_bracket,
    home_power: homePower || params.profileData?.home_power,
  })
  const postcodeDna = buildPostcodeDnaBlock({
    postcode: pc,
    localityContext,
    journeyKey,
  })

  const utilitiesCtx =
    journeyKey === 'utilities'
      ? await buildUtilitiesResearchContext({
          postcode: pc,
          homePower: homePower || null,
          journeyKey,
        })
      : { promptBlock: '' }

  const profilePrefix = buildLocalizedResearchPrefix({
    postcode: pc,
    profileData: params.profileData?.home_power
      ? params.profileData
      : homePower
        ? { ...(params.profileData ?? {}), home_power: homePower }
        : (params.profileData ?? null),
    category: cat,
    userContext: [postcodeDna, laneLock, utilitiesCtx.promptBlock, params.userContext ?? '']
      .filter(Boolean)
      .join('\n\n'),
  })

  let markdown = [
    profilePrefix,
    `## Location\nPostcode: ${pc}`,
    localityContext ? `## Locality\n${localityContext}` : '',
    `CURRENT_DOMAIN: ${cat}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const citations: ResearchCitation[] = []
  let firecrawlSourceCount = 0
  if (!shouldSkipFirecrawlScrape()) {
    const firecrawl = await fetchCategoryFirecrawlResearch({
      postcode: pc,
      category: cat,
      profileData: params.profileData ?? null,
      userContext: params.userContext ?? null,
      surgical: true,
    })
    firecrawlSourceCount = firecrawl.citations.length
    if (firecrawl.markdown.length > 80) {
      markdown = `${markdown}\n\n---\n\n${firecrawl.markdown}`
      citations.push(...firecrawl.citations)
    }
  }

  // Free scrape pass — always runs (no API key required). Fetches static UK gov/charity pages
  // per category. Caps at 2 URLs when Firecrawl already provided context, 3 when it didn't.
  {
    const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
    const freeSeeds = JOURNEY_FREE_SEEDS[journeyKey] ?? []
    const alreadyScrapedUrls = new Set(citations.map((c) => c.url).filter(Boolean))
    const unseenSeeds = freeSeeds.filter((u) => !alreadyScrapedUrls.has(u))
    const maxFreeUrls = citations.length > 0 ? 2 : 3
    if (unseenSeeds.length > 0) {
      const freeRows = await fetchMarkdownForUrlsFreeFirst(unseenSeeds, { minChars: 120, maxUrls: maxFreeUrls })
      if (freeRows.length > 0) {
        const freeBody = freeRows
          .map((r) => `### Free source: ${r.title || r.url}\n${r.markdown.slice(0, 3000)}`)
          .join('\n\n---\n\n')
        markdown = `${markdown}\n\n---\n\n## Live UK sources (free scrape)\n\n${freeBody}`
        for (const r of freeRows) {
          citations.push({
            source_name: r.title?.trim() || new URL(r.url).hostname.replace(/^www\./, ''),
            url: r.url,
            snippet: r.markdown.slice(0, 320),
            title: r.title,
          })
        }
      }
    }
  }

  // ZeroAgent pass — Gemini with function calling drives the research itself.
  // The model selects which free UK data APIs to call, executes them, then synthesises.
  // Runs regardless of bucket-failover mode — it uses free APIs, not paid Firecrawl.
  // Direct Gemini is the primary provider; OpenRouter is the fallback.
  let agentDidSynthesize = false
  if (process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim()) {
    const { runZeroAgent } = await import('@/lib/agents/zeroAgent')
    const agent = await runZeroAgent({
      postcode: pc,
      category: cat,
      profileBlock: profilePrefix,
      localityContext,
    })
    if (agent && agent.markdown.length > 80) {
      markdown = `${markdown}\n\n---\n\n## Agent synthesis\n\n${agent.markdown}`
      citations.push(...agent.citations.map((c) => ({ ...c, title: c.title })))
      agentDidSynthesize = true
      console.log(`[zeroAgent] ${cat}@${pc} — tools: ${agent.toolsUsed.join(', ')}`)
    }
  }

  // Fallback: direct Gemini pass when agent didn't run or produced nothing
  if (!agentDidSynthesize) {
    const deep = await deepGeminiSearchUkEnergyMarkdown({
      postcode: pc,
      profileData: params.profileData ?? null,
      localityContext,
      category: cat,
      lifestyleShift: params.lifestyleShift,
      userContext: params.userContext ?? null,
    })
    if (deep) {
      markdown = `${markdown}\n\n---\n\n${deep.markdown}`
      citations.push(...deep.citations)
    }
  }

  const parsed = await parseApril2026UnitRatesFromMarkdown(markdown)
  const primaryCitation = citations.find((c) => isDeepLinkedUkOfferUrl(c.url ?? '')) ?? citations[0]
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
    sourceUrl: primaryCitation?.url?.trim().startsWith('http')
      ? primaryCitation.url.trim()
      : PRICE_CAP_SOURCE_URL,
    skipResearchGeminiExtraction: shouldPreferMechanicalTripletInBucket(),
    invokePayload: {
      trigger: 'scrape-sync-fast',
      category: cat,
      firecrawl_sources: firecrawlSourceCount,
    },
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
  // Cost guard: GET /api/scrape-sync?postcode=X is hit independently by several Zone components
  // on every page load (no coordination between them) — skip the whole Firecrawl/Gemini chain
  // when a recent row already covers this (user, category, postcode).
  const guardCategory = normalizeResearchCategory(params.category) ?? 'general'
  if (await hasRecentResearchResult(params.userId, guardCategory, params.postcode)) {
    return { markdown: '', citations: [] }
  }
  // This is the general/baseline research path only (never the answer-specific JIT loop-spawn
  // pass — that goes through runTriggerResearchForCategory directly with its own answer
  // context). So when this user has no fresh row of their own yet, but the shared ownerless
  // pool already has fresh content for this category+postcode, reuse it instead of paying for
  // another near-identical scrape — the existing read path already serves ownerless rows to
  // users with no row of their own (see scrape-sync's research_results lookup), so there's
  // nothing more to write here.
  if (params.userId && (await hasRecentResearchResult(null, guardCategory, params.postcode))) {
    return { markdown: '', citations: [] }
  }

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
    profileData: params.profileData ?? null,
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
