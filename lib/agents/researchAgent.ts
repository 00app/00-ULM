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
import { getLocalData } from '@/lib/local/getLocalData'
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

/** Journey mother-card headline bounds — passed to clampZoneBentoHeadline for all category cards. */
const JOURNEY_CARD_HEADLINE_BOUNDS = {
  min: MIN_JOURNEY_CARD_HEADLINE_WORDS,
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
  /** Optional house number / name for EPC address disambiguation at postcode. */
  house_number?: string | null
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
 * Output keys align with `research_results`: `category`, `saving_amount_gbp`, `offer_url`, `agent_headline` (8–10 words zone card),
 * `architect_prose` (exactly three paragraphs, \\n\\n separated, max 40 words each, no UI section labels in text). Carbon kg for Zone
 * cards comes from `buildUserImpact` / scrapes, not a separate `verified_saving_kg` column on this row (see
 * `verified_saving` / impact pipeline elsewhere).
 */
/** Map retired direct-API ids → current Flash (see Google “no longer available to new users”). */
function resolveGeminiResearchModel(
  envVal: string | undefined,
  fallback: string,
  label: string
): string {
  const v = envVal?.trim()
  if (!v) return fallback
  if (/gemini-1\.5|gemini-2\.0|flash-lite/i.test(v)) {
    const canonical = fallback.includes('gemini-2.5') ? fallback : 'gemini-2.5-flash'
    console.warn(
      `[researchAgent] ${label}=${v} unavailable on direct API; using ${canonical}`
    )
    return canonical
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
  console.log('[DEBUG-triplet-gate] extractResearchTripletWithGemini markdown.length:', markdown.length)
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
- "saving_amount_gbp": non-negative number with up to two decimal places — annual GBP saving grounded in the scraped text (use 0 only if truly none inferable).
- "offer_url": one https URL copied verbatim from the markdown or citation context. If no live URL exists, return an empty string.
- "agent_headline": **Zone card heading** — **8 to 10 words**, punchy and benefit-driven (e.g. "line up your tariff with the april cap before you switch deals"). No colons. No section labels.
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
    console.log('[DEBUG-triplet-gate] raw text from generateResearchText:', text?.slice(0, 300))
    const parsed = parseResearchTripletJson(text)
    console.log('[DEBUG-triplet-gate] parsed result is null:', parsed == null)
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
    console.log('[DEBUG-triplet-gate] bailed: skipGemini true')
    return { markdown: params.markdown, triplet: null, extraCitations: [] }
  }
  const configuredProviders = listConfiguredBucketProviders()
  const rateLimited = isLlmRateLimited(configuredProviders)
  const preferMechanical = shouldPreferMechanicalTripletInBucket()
  console.log(
    '[DEBUG-triplet-gate]',
    JSON.stringify({ configuredProviders, rateLimited, preferMechanical })
  )
  if (rateLimited || preferMechanical) {
    console.log('[DEBUG-triplet-gate] bailed: rateLimited or preferMechanical')
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
                offer_url, locality_context
         FROM research_results
         WHERE id = $1
           AND (${incomplete})`,
        [rowId]
      )
      rows = r.rows
    } else if (uid) {
      const r = await pool.query<Row>(
        `SELECT id::text, markdown, citations, profile_snapshot, postcode, category,
                offer_url, locality_context
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
                offer_url, locality_context
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
                offer_url, locality_context
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
    const mechanical = mechanicalCategoryTripletFallback({
      category: row.category,
      offerUrl: row.offer_url,
      localityContext: row.locality_context,
      postcode: row.postcode,
    })
    if (mechanical) {
      try {
        const journeyKey = normalizeCategoryToJourneyKey(mechanical.category)
        await pool.query(
          `UPDATE research_results
           SET agent_headline = $2,
               architect_prose = $3,
               saving_amount_gbp = COALESCE($4::numeric, saving_amount_gbp),
               category = COALESCE($5, category),
               offer_url = COALESCE($6, offer_url),
               source_url = COALESCE($6, source_url),
               is_mechanical_fallback = true
           WHERE id::text = $1`,
          [
            row.id,
            clampZoneBentoHeadline(mechanical.agent_headline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS),
            mechanical.architect_prose,
            mechanical.saving_amount_gbp,
            mechanical.category,
            mechanical.offer_url,
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
function mechanicalCategoryTripletFallback(params: {
  category: string | null
  offerUrl: string | null
  localityContext: string | null
  postcode: string | null
}): {
  saving_amount_gbp: number
  agent_headline: string
  architect_prose: string
  offer_url: string
  category: string
} | null {
  let cat = normalizeResearchCategory(params.category)
  const outward = outwardFromPostcode(params.postcode)
  const townRaw =
    params.localityContext?.split(',')[0]?.trim() ||
    outward ||
    ''
  const areaLabel = townRaw || 'your area'
  const areaTag =
    areaLabel.length <= 28 ? areaLabel.toUpperCase() : areaLabel.slice(0, 28).toUpperCase()
  const capTypical = TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP

  if (outward || townRaw) {
    const fallbacks: Record<string, { gbp: number; headline: string; prose: string }> = {
      home: {
        gbp: 180,
        headline: `seal draughts and loft gaps in ${areaTag} homes first`,
        prose: `Older homes in ${areaLabel} leak heat through lofts, draughts, and lagging gaps — sealing those cuts bills before you chase a new boiler.\n\nJuly 2026 bills still track the energy price cap (~£${capTypical}/yr typical dual-fuel) so every wasted kWh hurts until fabric is fixed.\n\nUse the link below to plan loft and draught-proofing work before winter.`,
      },
      utilities: {
        gbp: 120,
        headline: `compare your household tariff before you fix a ${areaTag} deal`,
        prose: `${areaLabel} sits under the July 2026 price-cap frame — typical dual-fuel around £${capTypical}/yr with policy shifts worth tracking before you fix a tariff.\n\nStanding charges and direct-debit realignment are the immediate levers before locking a fixed tariff.\n\nUse the link below to check your supplier statement matches cap rates before you switch.`,
      },
      grants: {
        gbp: MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP,
        headline: `check heat pump grant rules for your ${areaTag} home`,
        prose: `${areaLabel} may qualify for the government's heat pump grant in 2026 when your home and energy rating meet GOV.UK rules — many homes get up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString('en-GB')} toward an air-source heat pump; oil and LPG homes may access up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026.toLocaleString('en-GB')} from July 2026 where eligible.\n\nThat sits beside your heating bills so you see grant cash and lower running costs together, not generic comparison-site chatter.\n\nUse the link below to check you qualify and compare installer quotes before you sign anything.`,
      },
      solar: {
        gbp: 450,
        headline: `size solar panels to your roof in ${areaTag} now`,
        prose: `Solar in ${areaLabel} pays when generation, export rate, and daytime use align — typical homes cut import costs once an MCS install is sized to the roof.\n\nJuly 2026 import rates still follow the price-cap frame (~£${capTypical}/yr typical dual-fuel), so export and self-use matter for what you buy overnight.\n\nUse the link below to compare export tariffs with your supplier before you lock an install quote.`,
      },
      travel: {
        gbp: 450,
        headline: `swap one weekly car commute for rail in ${areaTag}`,
        prose: `Around ${areaLabel}, one regular car commute is often the priciest habit on your travel row — a single rail or bus day each week is a gentle first swap.\n\nLocal timetables and season tickets still beat ad-hoc fuel top-ups when you plan the same journey twice.\n\nUse the link below to check rail or bus options for your usual route before you renew insurance or fuel cards.`,
      },
      holidays: {
        gbp: 250,
        headline: `cut flights from ${areaTag} with more local rail trips`,
        prose: `Holidays from ${areaLabel} carry a heavy footprint — fewer flights and rail over short hops cuts both kg and spend.\n\nOne less return flight a year often saves hundreds before airline surcharges climb again.\n\nUse the link below to compare flight vs rail for your next break before you book.`,
      },
      food: {
        gbp: 180,
        headline: `plan meals from your fridge to cut ${areaTag} waste`,
        prose: `Food budgets in ${areaLabel} leak cash through packaging and waste — a tighter weekly basket plan lands savings at the till.\n\nLow-waste, plant-rich meals aligned with local shops often trim ~£180/yr without a loyalty gimmick.\n\nUse the link below to try a meal planner and cut what you throw away each week.`,
      },
      shopping: {
        gbp: 110,
        headline: `repair before you replace home items in ${areaTag} again`,
        prose: `Shopping in ${areaLabel} rewards repair-over-replace — second-hand and fix-it shops beat fast-fashion churn on both £ and kg.\n\nShifting a few purchases to circular outlets can move ~£110/yr without changing your whole wardrobe.\n\nUse the link below to find repair shops or low-waste retailers near you.`,
      },
      money: {
        gbp: 320,
        headline: `move idle cash to a better rate from ${areaTag}`,
        prose: `Where you bank and save in ${areaLabel} still funds oil and gas unless you pick cleaner accounts.\n\nGreen ISAs and certified banks can move ~£320/yr of footprint without giving up yield entirely.\n\nUse the link below to compare greener banking options before you move cash.`,
      },
      tech: {
        gbp: 140,
        headline: `cut standby power on devices around your ${areaTag} home`,
        prose: `Smart meters and thermostats in ${areaLabel} trim bills fast under the April 2026 cap frame.\n\nHeating empty rooms or running an old boiler quietly adds ~£140/yr — timers and zoning fix that.\n\nUse the link below to see if your supplier offers free smart meter installs locally.`,
      },
      water: {
        gbp: 90,
        headline: `fix drips and fit aerators in your ${areaTag} home`,
        prose: `Water bills in ${areaLabel} keep rising on sewage and metered tariffs — conservation pays back quickly.\n\nRain butts and shower aerators can shave ~£90/yr off metered volume.\n\nUse the link below to claim free water-saving inserts from your water company.`,
      },
      waste: {
        gbp: 70,
        headline: `sort recycling and compost at your ${areaTag} home today`,
        prose: `Waste rules in ${areaLabel} follow local council collections — sorting soft plastics and composting cuts landfill trips.\n\nA steady compost and recycling habit can save ~£70/yr in bags, trips, and contamination fines.\n\nUse the link below to confirm collection dates and rules for your street.`,
      },
      carbon: {
        gbp: 100,
        headline: `track your biggest home habit each month in ${areaTag} living`,
        prose: `Carbon tracking in ${areaLabel} maps to the 12,000 kWh ≈ 1 tonne baseline — small daily cuts compound.\n\nLogging heat, travel, and food for a fortnight often finds ~£100/yr of easy wins.\n\nUse the link below to run your household footprint against the national timeline.`,
      },
    }

    const targetCat = cat || 'home'
    const journeyKey = normalizeCategoryToJourneyKey(targetCat)
    const fallback = fallbacks[targetCat] ?? fallbacks.home
    const prose = normalizeArchitectProseThreeParagraphs(fallback.prose)
    if (!prose) return null
    // Locality-aware headline always wins here — we're already inside the branch that has a
    // real area label. ZONE_BENTO_HOOK (fully generic, no locality) is only for when there's none.
    return {
      saving_amount_gbp: fallback.gbp,
      agent_headline: clampZoneBentoHeadline(fallback.headline, journeyKey, JOURNEY_CARD_HEADLINE_BOUNDS),
      architect_prose: prose,
      offer_url: trustedUrlForJourney(journeyKey),
      category: journeyKey,
    }
  }

  const url = (params.offerUrl ?? '').trim()
  if (!url.startsWith('http')) return null
  if (!cat) {
    if (url.includes('boiler-upgrade')) cat = 'grants'
    else if (url.includes('ofgem') && /price-cap|energy-advice/i.test(url)) cat = 'bills'
    else return null
  }

  if (cat === 'grants' && url.includes('boiler-upgrade')) {
    const gbp = MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP
    const agent_headline =
      zoneCardHeadlineFromRaw(
        `check heat pump grant rules for your ${areaTag} home`,
        `check heat pump grant rules for your ${areaTag} home`,
        MAX_JOURNEY_CARD_HEADLINE_WORDS
      ) || `check heat pump grant rules for your ${areaTag} home`
    const architect_prose =
      normalizeArchitectProseThreeParagraphs(
        `${areaLabel} may qualify for the government's heat pump grant in 2026 when your home and energy rating meet GOV.UK rules — many homes get up to £${gbp.toLocaleString('en-GB')} toward an air-source heat pump; oil and LPG homes may access up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026.toLocaleString('en-GB')} from July 2026 where eligible.\n\nThat sits beside your heating bills so you see grant cash and lower running costs together, not generic comparison-site chatter.\n\nUse the link below to check you qualify and compare installer quotes before you sign anything.`
      ) ?? ''
    if (!architect_prose) return null
    return {
      saving_amount_gbp: gbp,
      agent_headline: clampZoneBentoHeadline(agent_headline, 'grants', JOURNEY_CARD_HEADLINE_BOUNDS),
      architect_prose,
      offer_url: trustedUrlForJourney('grants'),
      category: 'grants',
    }
  }

  if (url.includes('ofgem') && /price-cap|energy-advice/i.test(url)) {
    const gbp = TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP
    const agent_headline =
      zoneCardHeadlineFromRaw(
        `compare your household tariff before you fix a ${areaLabel} deal`,
        `compare your household tariff before you fix a ${areaTag} deal`,
        MAX_JOURNEY_CARD_HEADLINE_WORDS
      ) || `compare your household tariff before you fix a ${areaTag} deal`
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
      : 'https://www.gov.uk/',
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
       ADD COLUMN IF NOT EXISTS is_mechanical_fallback BOOLEAN NOT NULL DEFAULT false`
    )
    const deepResolved = params.deepLink ?? params.sourceUrl ?? null

    const explicitTriplet = researchTripletExplicitFromParams(params)
    const skipGemini =
      params.skipResearchGeminiExtraction === true || explicitTriplet != null
    console.log(
      '[DEBUG-triplet-gate]',
      JSON.stringify({
        skipResearchGeminiExtraction: params.skipResearchGeminiExtraction,
        explicitTripletIsNull: explicitTriplet == null,
        skipGemini,
      })
    )
    const { markdown: workingMarkdown, triplet: geminiTriplet, extraCitations } =
      await resolveResearchTripletWithRecovery({
        markdown: params.markdown,
        postcode: params.postcode ?? null,
        profileData: params.profileData ?? null,
        skipGemini,
        categoryHint: params.category ?? null,
      })
    console.log('[DEBUG-triplet-gate] geminiTriplet is null:', geminiTriplet == null)
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
    const needsMechanicalHeadline =
      headlineWordCount > 0 && headlineWordCount < MIN_JOURNEY_CARD_HEADLINE_WORDS
    // Tracks specifically whether the £ figure (not just headline/prose) came from the shared
    // per-category template rather than genuine research — that's the only thing gating the
    // scraped-overlay in buildScrapedFromResearchResults needs to know. A row can legitimately
    // use the mechanical headline/prose while keeping a real, already-settled saving amount.
    let savingIsMechanicalFallback = false
    if ((tripletEmpty || needsMechanicalHeadline) && (mergedOffer || mergedCategory)) {
      const mechanical = mechanicalCategoryTripletFallback({
        category: mergedCategory,
        offerUrl: mergedOffer ?? trustedUrlForJourney(journeyKeyForHeadline),
        localityContext: params.localityContext ?? null,
        postcode: params.postcode ?? null,
      })
      if (mechanical) {
        if (savingForDb == null || savingForDb <= 0) {
          savingForDb = mechanical.saving_amount_gbp
          savingIsMechanicalFallback = true
        }
        mergedAgentHeadline = mechanical.agent_headline
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
        JOURNEY_CARD_HEADLINE_BOUNDS
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
           is_high_impact, carbon_impact_kg, is_mechanical_fallback, created_at
         )
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::numeric, $14, $15, $16, $17, $18::jsonb, $19, $20::numeric, $21, NOW())`,
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
           offer_url, source_url, markdown, citations, is_mechanical_fallback, locality_context
         ) VALUES ($1, $2, $3::numeric, $4, $5, $6, $7, $8, $9::jsonb, true, $10)`,
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
