/**
 * Personal research auditor — Firecrawl (trusted UK seeds) + Gemini vs user baseline.
 *
 * Profile + goal come from `public.users` and `user_genome.profile_goal` (not a separate
 * `user_profiles` table). Genome answers from `journey_answers_jsonb` enrich the prompt.
 * Results persist via `persistResearchResult` → `research_results` (offer_url, saving_amount_gbp, etc.).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '@/lib/db'
import { FIRECRAWL_API_KEY, getFirecrawlClient } from '@/lib/sentinel/api-config'
import { getJourneyAnswersForUser } from '@/lib/db/neon'
import { UK_2026_SEED_URLS, persistResearchResult } from '@/lib/agents/researchAgent'
import { getLatestResearchUnitRates } from '@/lib/db/neon'
import { JOURNEY_IDS } from '@/lib/journeys'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const AUDIT_MODEL = 'gemini-2.5-flash-lite'
const MAX_SCRAPE_CHARS_PER_URL = 4500
const MAX_SEED_URLS = 5

export type PersonalAuditResult = {
  ok: boolean
  userId: string
  savingGbp?: number
  offerUrl?: string
  prose?: string
  error?: string
}

type UserAuditRow = {
  id: string
  postcode: string | null
  household: string | null
  home_type: string | null
  transport_baseline: string | null
  name: string | null
  user_genome: Record<string, unknown> | null
}

function isUuid(id: string): boolean {
  return UUID_RE.test(id.trim())
}

export function profileGoalFromGenome(genome: Record<string, unknown> | null | undefined): string {
  const g = genome?.profile_goal
  if (g === 'money' || g === 'carbon' || g === 'balanced') return g
  return 'balanced'
}

const AUDITOR_CATEGORY_WHITELIST = new Set<string>([...JOURNEY_IDS, 'general'])

function parseAuditorJson(raw: string): {
  prose: string
  category: string
  saving_amount_gbp: number
  offer_url: string
} | null {
  let t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const j = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
    const prose = typeof j.prose === 'string' ? j.prose.trim() : ''
    const catRaw = typeof j.category === 'string' ? j.category.trim().toLowerCase() : ''
    const category = AUDITOR_CATEGORY_WHITELIST.has(catRaw) ? catRaw : 'general'
    const sav =
      typeof j.saving_amount_gbp === 'number'
        ? j.saving_amount_gbp
        : Number(j.saving_amount_gbp ?? j.saving)
    const offer_url =
      typeof j.offer_url === 'string'
        ? j.offer_url.trim()
        : typeof j.url === 'string'
          ? j.url.trim()
          : ''
    if (!prose || !Number.isFinite(sav) || sav < 0 || !offer_url.startsWith('http')) return null
    return { prose, category, saving_amount_gbp: Math.round(sav), offer_url }
  } catch {
    return null
  }
}

/**
 * Load onboarding + goal from `users` (see `user_genome.profile_goal`).
 */
export async function fetchUserAuditContext(userId: string): Promise<UserAuditRow | null> {
  if (!isUuid(userId)) return null
  const res = await pool.query<UserAuditRow>(
    `SELECT id, postcode, household, home_type, transport_baseline, name, user_genome
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  )
  return res.rows[0] ?? null
}

/**
 * Scrape a small set of UK-trusted URLs (grants, price-cap context, tips) — not generic web search.
 */
export async function scrapeAuditCorpus(postcode: string): Promise<string> {
  const fc = getFirecrawlClient()
  if (!fc) return ''

  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  const sections: string[] = [`## Audit locality\nPostcode: ${pc}\n`]

  for (const url of UK_2026_SEED_URLS.slice(0, MAX_SEED_URLS)) {
    try {
      const result = (await fc.scrapeUrl(url, {
        formats: ['markdown'],
        onlyMainContent: true,
      })) as { success?: boolean; markdown?: string }
      if (result?.success && typeof result.markdown === 'string' && result.markdown.trim()) {
        sections.push(`\n### ${url}\n${result.markdown.trim().slice(0, MAX_SCRAPE_CHARS_PER_URL)}`)
      }
    } catch {
      // continue
    }
  }

  return sections.join('\n')
}

function buildAuditPrompt(params: {
  profile: UserAuditRow
  goal: string
  scrapedMarkdown: string
  journeySummary: string
  baselineElecGbpPerKwh: number | null
}): string {
  const baseline =
    params.baselineElecGbpPerKwh != null && Number.isFinite(params.baselineElecGbpPerKwh)
      ? `User's latest stored home electricity rate (approx): £${params.baselineElecGbpPerKwh.toFixed(4)}/kWh.`
      : 'No stored unit rate; assume a typical UK default tariff around £0.29/kWh for comparison only (not financial advice).'

  return `You are a UK household energy auditor. Use ONLY the scraped markdown and user context below.
User goal: ${params.goal} (money = emphasise £ savings; carbon = emphasise kg CO2 avoided; balanced = both briefly).

${baseline}

Household: ${params.profile.household ?? '—'}, home: ${params.profile.home_type ?? '—'}, transport: ${params.profile.transport_baseline ?? '—'}.

Journey answers (may be partial JSON):
${params.journeySummary.slice(0, 6000)}

Scraped reference content (gov / EST / Which / MSE / Octopus blog — verify claims against these sources only):
${params.scrapedMarkdown.slice(0, 24_000)}

Task:
1. Infer ONE concrete action (switch tariff, grant application, insulation tip, or transport habit) that fits the user and sources.
2. Choose "category" as exactly one of: home, travel, food, shopping, money, carbon, tech, waste, holidays, general — best thematic fit for that action.
3. Estimate plausible annual GBP saving vs their baseline as integer "saving_amount_gbp" (conservative if uncertain).
4. Set "offer_url" to ONE https URL from the scraped markdown above that best supports the action (must appear verbatim in the markdown).

Return ONLY valid JSON, no markdown wrapper:
{"prose":"one short imperative paragraph, UK English","category":"money","saving_amount_gbp":123,"offer_url":"https://..."}`
}

/**
 * Run a full personal audit for one user: scrape → Gemini → `research_results`.
 */
export async function runPersonalAudit(userId: string): Promise<PersonalAuditResult> {
  if (!isUuid(userId)) {
    return { ok: false, userId, error: 'invalid user id' }
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (!geminiKey) {
    return { ok: false, userId, error: 'GEMINI_API_KEY unset' }
  }
  if (!FIRECRAWL_API_KEY) {
    return { ok: false, userId, error: 'FIRE_CRAWL_KEY_2 or FIRECRAWL_API_KEY unset' }
  }

  const profile = await fetchUserAuditContext(userId)
  if (!profile?.postcode?.trim()) {
    return { ok: false, userId, error: 'user has no postcode' }
  }

  const postcode = profile.postcode.replace(/\s+/g, '').toUpperCase()
  const genome = (profile.user_genome ?? {}) as Record<string, unknown>
  const goal = profileGoalFromGenome(genome)

  const [journeyAnswers, ratesRow] = await Promise.all([
    getJourneyAnswersForUser(userId),
    getLatestResearchUnitRates(postcode, userId),
  ])

  const journeySummary = JSON.stringify(journeyAnswers)
  const baselineElec = ratesRow?.elec_unit_rate_gbp_per_kwh ?? null

  const scrapedMarkdown = await scrapeAuditCorpus(postcode)
  if (!scrapedMarkdown.trim()) {
    return { ok: false, userId, error: 'no scrape content (Firecrawl failed or blocked)' }
  }

  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({
    model: AUDIT_MODEL,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.25 },
  })

  const prompt = buildAuditPrompt({
    profile,
    goal,
    scrapedMarkdown,
    journeySummary,
    baselineElecGbpPerKwh: baselineElec,
  })

  let text = ''
  try {
    const out = await model.generateContent(prompt)
    text = out.response.text() ?? ''
  } catch (e) {
    return { ok: false, userId, error: e instanceof Error ? e.message : 'gemini failed' }
  }

  const parsed = parseAuditorJson(text)
  if (!parsed) {
    return { ok: false, userId, error: 'gemini did not return valid JSON' }
  }

  const citation = [{ source_name: 'Personal audit', url: parsed.offer_url, snippet: parsed.prose.slice(0, 240) }]

  try {
    await persistResearchResult({
      userId,
      postcode,
      profileData: {
        postcode,
        profile_goal: goal,
        household: profile.household,
        home_type: profile.home_type,
        transport_baseline: profile.transport_baseline,
        audit: 'personal_audit_v1',
      },
      markdown: `${scrapedMarkdown}\n\n---\n\n## Auditor summary\n${parsed.prose}`,
      citations: citation,
      elecUnitRateGbpPerKwh: baselineElec,
      gasUnitRateGbpPerKwh: ratesRow?.gas_unit_rate_gbp_per_kwh ?? null,
      sourceUrl: parsed.offer_url,
      deepLink: parsed.offer_url,
      category: parsed.category,
      offerUrl: parsed.offer_url,
      savingAmountGbp: parsed.saving_amount_gbp,
      verifiedSaving: parsed.saving_amount_gbp,
      localityContext: `${postcode} · ${goal}`,
      providerName: 'Zero Zero auditor',
      agentHeadline: parsed.prose.slice(0, 120).replace(/\s+/g, ' ').trim(),
      architectProse: parsed.prose.slice(0, 4000),
      skipResearchGeminiExtraction: true,
      invokePayload: {
        kind: 'personal_audit',
        model: AUDIT_MODEL,
        category: parsed.category,
        saving_amount_gbp: parsed.saving_amount_gbp,
        offer_url: parsed.offer_url,
      },
    })
  } catch (e) {
    return { ok: false, userId, error: e instanceof Error ? e.message : 'persist failed' }
  }

  return {
    ok: true,
    userId,
    savingGbp: parsed.saving_amount_gbp,
    offerUrl: parsed.offer_url,
    prose: parsed.prose,
  }
}
