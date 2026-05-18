/**
 * Scrape-sync API
 * GET: returns current scraped values for the dashboard (from DB or UK 2026 defaults).
 *    Optional ?postcode= triggers ZeroResearch (Firecrawl / Gemini) for fresh regional grant data; response includes research.citations when present.
 * POST: accepts 001 Crawler payload and upserts into scraped_summary for hero totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import {
  getJourneyAnswersForUser,
  upsertJourneyAnswerJsonb,
  upsertUserGenomeFromAnswer,
} from '@/lib/db/neon'
import { JOURNEY_ORDER, type JourneyId, isValidJourneyQuestion } from '@/lib/journeys'
import {
  loadDynamicUserProfileForResearch,
  repairResearchResultsMissingHeadlines,
  runTriggerResearchForCategory,
  runZeroResearchWithProfile,
  type ResearchProfileData,
} from '@/lib/agents/researchAgent'
import { mirrorJourneyAnswersToUserProfilesIfAvailable } from '@/lib/db/userProfilesMirror'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { getLatestResearchUnitRates } from '@/lib/db/neon'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import {
  applyScrapeSyncTriggerFlags,
  scrapeSyncAuthDeniedResponse,
  scrapeSyncBearerMatches,
  scrapeSyncTriggerRequested,
} from '@/lib/intelligence/scrapeSyncAuth'
import { foldCoverageRowsForZone, researchCategoryToJourneyKey } from '@/lib/zone/neonResearchMerge'
import { GARY_RESEARCH_USER_ID } from '@/lib/zone/garyMode'
import { ensureGaryDemoUser } from '@/lib/db/ensureGaryDemoUser'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import {
  isLifestyleShiftMode,
  maybeBirthAchievementFromScrapeSync,
  urlShieldForAchievement,
} from '@/lib/zone/scrapeSyncLifestyle'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300
const SCRAPE_SYNC_MAX_PER_MINUTE = 24

function isValidResearchUserId(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim())
}

function resolveResearchUserId(
  sessionUserId: string | null,
  request: NextRequest,
  opts?: { bodyUserId?: string | null }
): string | null {
  if (sessionUserId && isValidResearchUserId(sessionUserId)) return sessionUserId
  const fromBody = opts?.bodyUserId?.trim() ?? ''
  if (fromBody && isValidResearchUserId(fromBody)) return fromBody
  const fromQuery = request.nextUrl.searchParams.get('user_id')?.trim() ?? ''
  if (fromQuery && isValidResearchUserId(fromQuery)) return fromQuery
  return null
}

/** Firecrawl gate — `FIRE_CRAWL_KEY_2` must match Production Vercel exactly. */
function firecrawlMissingResponse(): NextResponse | null {
  const scraperKey = process.env.FIRE_CRAWL_KEY_2?.trim() || ''
  if (!scraperKey) {
    return NextResponse.json({ error: 'Scraper not configured' }, { status: 503 })
  }
  return null
}

interface ScrapedPayloadItem {
  journey_key: JourneyId
  carbon_value: number
  money_value: number
  deep_content_tip?: string
  high_saving?: boolean
}

function mapResearchCoverageRows(
  rows: Array<{
    cat: string
    architect_prose: string | null
    agent_headline: string | null
    offer_url: string | null
    source_url: string | null
    saving_amount_gbp: unknown
    verified_saving: unknown
    verified: unknown
  }>
): Record<string, ResearchCategoryCoverageRow> {
  const out: Record<string, ResearchCategoryCoverageRow> = {}
  const toNum = (v: unknown): number | null => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  for (const row of rows) {
    const k = String(row.cat || '').trim().toLowerCase()
    if (!k) continue
    const prose = typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
    const headline = typeof row.agent_headline === 'string' ? row.agent_headline.trim() : ''
    const offer = typeof row.offer_url === 'string' ? row.offer_url.trim() : ''
    const src = typeof row.source_url === 'string' ? row.source_url.trim() : ''
    const sav = toNum(row.saving_amount_gbp)
    const ver = toNum(row.verified_saving)
    const hasOffer = offer.startsWith('http')
    const hasSrc = src.startsWith('http')
    const insightReady =
      prose.length > 0 ||
      headline.length > 0 ||
      (sav != null && sav > 0) ||
      (ver != null && ver > 0) ||
      hasOffer
    const rowVerified = row.verified === true
    out[k] = {
      insightReady,
      hasOffer,
      verified: rowVerified,
      latestSavingGbp: sav,
      latestVerifiedGbp: ver,
      latestOfferUrl: hasOffer ? offer.slice(0, 2048) : null,
      latestSourceUrl: hasSrc ? src.slice(0, 2048) : null,
      architectProse: prose.length > 0 ? prose.slice(0, 4000) : null,
      agentHeadline: headline.length > 0 ? headline.slice(0, 320) : null,
    }
  }
  return out
}

const RESEARCH_COVERAGE_SELECT = `SELECT DISTINCT ON (lower(trim(rr.category)))
          lower(trim(rr.category)) AS cat,
          rr.architect_prose,
          rr.agent_headline,
          rr.offer_url,
          rr.source_url,
          rr.saving_amount_gbp,
          rr.verified_saving,
          rr.verified`

async function loadResearchCategoryCoverage(userId: string): Promise<Record<string, ResearchCategoryCoverageRow>> {
  try {
    const cov = await pool.query<{
      cat: string
      architect_prose: string | null
      agent_headline: string | null
      offer_url: string | null
      source_url: string | null
      saving_amount_gbp: unknown
      verified_saving: unknown
      verified: unknown
    }>(
      `${RESEARCH_COVERAGE_SELECT}
       FROM research_results rr
       WHERE rr.user_id = $1::uuid AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
       ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`,
      [userId]
    )
    return mapResearchCoverageRows(cov.rows)
  } catch (err) {
    console.warn('[scrape-sync] research_category_coverage:', err)
    return {}
  }
}

/** Guest sessions: rows may be keyed by postcode only (`user_id` null). Merge postcode + user coverage. */
async function loadResearchCategoryCoverageResolved(
  userId: string | null,
  postcode: string
): Promise<Record<string, ResearchCategoryCoverageRow>> {
  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  const byUser = userId ? await loadResearchCategoryCoverage(userId) : {}
  if (pc.length < 4) return byUser
  const byPc = await loadResearchCategoryCoverageByPostcode(pc)
  if (Object.keys(byUser).length === 0) return byPc
  return { ...byPc, ...byUser }
}

async function loadResearchCategoryCoverageByPostcode(
  postcode: string
): Promise<Record<string, ResearchCategoryCoverageRow>> {
  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  if (pc.length < 4) return {}
  try {
    const cov = await pool.query<{
      cat: string
      architect_prose: string | null
      agent_headline: string | null
      offer_url: string | null
      source_url: string | null
      saving_amount_gbp: unknown
      verified_saving: unknown
      verified: unknown
    }>(
      `${RESEARCH_COVERAGE_SELECT}
       FROM research_results rr
       WHERE REPLACE(COALESCE(rr.postcode, ''), ' ', '') = $1
         AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
       ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`,
      [pc]
    )
    return mapResearchCoverageRows(cov.rows)
  } catch (err) {
    console.warn('[scrape-sync] research_category_coverage_postcode:', err)
    return {}
  }
}

async function buildScrapedFromResearchResults(
  postcode: string,
  userId: string | null
): Promise<ScrapedPayloadItem[] | null> {
  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  if (pc.length < 4) return null
  const toNum = (v: unknown): number => {
    if (v == null) return 0
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  try {
    const cov = await pool.query<{
      cat: string
      architect_prose: string | null
      agent_headline: string | null
      saving_amount_gbp: unknown
      verified_saving: unknown
      carbon_impact_kg: unknown
    }>(
      userId
        ? `${RESEARCH_COVERAGE_SELECT}
           FROM research_results rr
           WHERE (rr.user_id = $1::uuid OR REPLACE(COALESCE(rr.postcode, ''), ' ', '') = $2)
             AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
           ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`
        : `${RESEARCH_COVERAGE_SELECT}
           FROM research_results rr
           WHERE REPLACE(COALESCE(rr.postcode, ''), ' ', '') = $1
             AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
           ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`,
      userId ? [userId, pc] : [pc]
    )
    if (cov.rows.length === 0) return null
    const byJourney = new Map<JourneyId, (typeof cov.rows)[0]>()
    for (const row of cov.rows) {
      const jid = researchCategoryToJourneyKey(String(row.cat || ''))
      if (!jid) continue
      const existing = byJourney.get(jid)
      const sav = toNum(row.saving_amount_gbp) || toNum(row.verified_saving)
      const prevSav = existing ? toNum(existing.saving_amount_gbp) || toNum(existing.verified_saving) : 0
      if (!existing || sav > prevSav) byJourney.set(jid, row)
    }
    const hasAny = [...byJourney.values()].some((row) => {
      const sav = toNum(row.saving_amount_gbp) || toNum(row.verified_saving)
      const prose = typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
      const headline = typeof row.agent_headline === 'string' ? row.agent_headline.trim() : ''
      return sav > 0 || prose.length > 0 || headline.length > 0
    })
    if (!hasAny) return null
    return JOURNEY_ORDER.map((key) => {
      const row = byJourney.get(key)
      const sav = row ? toNum(row.saving_amount_gbp) || toNum(row.verified_saving) : 0
      const carbon = row ? toNum(row.carbon_impact_kg) : 0
      const prose = row && typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
      const headline = row && typeof row.agent_headline === 'string' ? row.agent_headline.trim() : ''
      const tip = prose.length > 0 ? prose.slice(0, 280) : headline.length > 0 ? headline.slice(0, 280) : undefined
      return {
        journey_key: key,
        scraped_at: new Date().toISOString(),
        carbon_value: carbon > 0 ? Math.round(carbon) : 0,
        money_value: sav > 0 ? Math.round(sav) : 0,
        deep_content_tip: tip,
        high_saving: sav >= 500,
      }
    })
  } catch (err) {
    console.warn('[scrape-sync] buildScrapedFromResearchResults:', err)
    return null
  }
}

/** GET — Return scraped data for dashboard (buildUserImpact options.scraped). Optional ?postcode= triggers fresh regional research. */
export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = checkRateLimit(`scrape-sync:${id}`, SCRAPE_SYNC_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }
  /** Honest empty shape — never fabricate £/kg when Neon has no rows. */
  const fallbackDefaults = () =>
    JOURNEY_ORDER.map((key) => ({
      journey_key: key,
      scraped_at: new Date().toISOString(),
      carbon_value: 0,
      money_value: 0,
      deep_content_tip: 'Computing...',
      high_saving: false,
    }))
  try {
    const session = await getSessionFromRequest().catch(() => null)
    const sessionUserId = session?.userId ?? null
    const researchUserId = resolveResearchUserId(sessionUserId, request)
    const sessionResearchProfile =
      researchUserId != null
        ? await loadDynamicUserProfileForResearch(researchUserId).catch(() => null)
        : null
    const postcodeRaw =
      request.nextUrl.searchParams.get('postcode')?.trim() ||
      sessionResearchProfile?.postcode?.trim() ||
      ''
    const postcode = postcodeRaw.replace(/\s+/g, '').toUpperCase()
    if (researchUserId === GARY_RESEARCH_USER_ID && postcode.length >= 4) {
      await ensureGaryDemoUser(postcode).catch(() => null)
    }
    const tier2Category = request.nextUrl.searchParams.get('category')?.trim().toLowerCase() ?? ''
    const tier2Answer = request.nextUrl.searchParams.get('answer')?.trim() ?? ''
    const tier2QuestionId = request.nextUrl.searchParams.get('question_id')?.trim() ?? ''

    /** Tier 2 mother/child swap — scoped category re-research after Solo Focus answer. */
    if (postcode.length >= 4 && tier2Category && tier2Answer) {
      const fcErr = firecrawlMissingResponse()
      if (fcErr) return fcErr
      const profileData: ResearchProfileData = {
        ...(sessionResearchProfile?.home_type ? { home_type: sessionResearchProfile.home_type } : {}),
        ...(sessionResearchProfile?.transport_baseline
          ? { transport_baseline: sessionResearchProfile.transport_baseline }
          : {}),
        ...(sessionResearchProfile?.household ? { household: sessionResearchProfile.household } : {}),
        ...(sessionResearchProfile?.employment_status
          ? { employment_status: sessionResearchProfile.employment_status }
          : {}),
        postcode,
      }
      const userContext = [
        `postcode: ${postcode}`,
        `Solo Focus Tier 2 category: ${tier2Category}`,
        `Child answer: ${tier2Answer.slice(0, 800)}`,
      ].join('\n')

      const tier2JourneyKey = researchCategoryToJourneyKey(tier2Category) ?? tier2Category
      if (
        researchUserId &&
        tier2QuestionId &&
        isValidJourneyQuestion(tier2JourneyKey, tier2QuestionId)
      ) {
        const tier2Q = tier2QuestionId
        await upsertJourneyAnswerJsonb(researchUserId, tier2JourneyKey, tier2Q, tier2Answer)
        await upsertUserGenomeFromAnswer(researchUserId, tier2JourneyKey, tier2Q, tier2Answer)
        const genome = await getJourneyAnswersForUser(researchUserId).catch(() => ({}))
        await mirrorJourneyAnswersToUserProfilesIfAvailable(researchUserId, genome)
      }

      await runTriggerResearchForCategory({
        postcode,
        category: tier2Category,
        profileData: Object.keys(profileData).length > 0 ? profileData : undefined,
        userId: researchUserId,
        userContext,
      })
      await repairResearchResultsMissingHeadlines({
        userId: researchUserId,
        postcode,
        profileData: Object.keys(profileData).length > 0 ? profileData : null,
        limit: 4,
      })
      const tier2Coverage = await loadResearchCategoryCoverageResolved(researchUserId, postcode)
      const folded = tier2Coverage ? foldCoverageRowsForZone(tier2Coverage) : {}
      const row = folded[tier2Category]
      return NextResponse.json({
        tier2: true,
        category: tier2Category,
        answer: tier2Answer.slice(0, 800),
        research_category_coverage: folded,
        researchMeta: row
          ? {
              offer_url: row.latestOfferUrl,
              source_url: row.latestSourceUrl,
              audit_source_url: row.latestOfferUrl ?? row.latestSourceUrl,
              saving_amount_gbp: row.latestSavingGbp,
              verified_saving: row.latestVerifiedGbp,
              category: tier2Category,
              architect_prose: row.architectProse,
            }
          : null,
      })
    }

    let researchCategoryCoverage =
      postcode.length >= 4 || researchUserId != null
        ? await loadResearchCategoryCoverageResolved(researchUserId, postcode)
        : undefined
    if (researchCategoryCoverage) {
      researchCategoryCoverage = foldCoverageRowsForZone(researchCategoryCoverage)
    }
    if (postcode && postcode.length > 12) {
      return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
    }
    let research: { markdown: string; citations: Array<{ source_name: string; url: string; snippet?: string }> } | undefined

    const forceResearch = ['1', 'true', 'yes'].includes(
      String(request.nextUrl.searchParams.get('force') ?? '').toLowerCase()
    )
    const repairHeadlines = ['1', 'true', 'yes'].includes(
      String(request.nextUrl.searchParams.get('repair') ?? '').toLowerCase()
    )

    /** Lightweight backfill — rows with £ but missing agent_headline / architect_prose (no full Firecrawl loop). */
    if (postcode.length >= 4 && repairHeadlines && !forceResearch) {
      const profileData: ResearchProfileData = {
        ...(sessionResearchProfile?.home_type ? { home_type: sessionResearchProfile.home_type } : {}),
        ...(sessionResearchProfile?.transport_baseline
          ? { transport_baseline: sessionResearchProfile.transport_baseline }
          : {}),
        ...(sessionResearchProfile?.household ? { household: sessionResearchProfile.household } : {}),
        postcode,
      }
      await repairResearchResultsMissingHeadlines({
        userId: researchUserId,
        postcode,
        profileData: Object.keys(profileData).length > 0 ? profileData : null,
        limit: 8,
      })
      researchCategoryCoverage = await loadResearchCategoryCoverageResolved(researchUserId, postcode)
      if (researchCategoryCoverage) {
        researchCategoryCoverage = foldCoverageRowsForZone(researchCategoryCoverage)
      }
      const fromResearch = await buildScrapedFromResearchResults(postcode, researchUserId)
      if (fromResearch?.length) {
        return NextResponse.json({
          scraped: fromResearch,
          source: 'research_results' as const,
          repaired: true,
          ...(researchCategoryCoverage !== undefined
            ? { research_category_coverage: researchCategoryCoverage }
            : {}),
        })
      }
    }

    /** GET without `force=true` must stay fast (Zone load, Vercel deployment checks). Heavy research: POST trigger or GET `?force=true`. */
    if (postcode && forceResearch) {
      const fcErr = firecrawlMissingResponse()
      if (fcErr) return fcErr
      const profileData: ResearchProfileData = {
        ...(sessionResearchProfile?.home_type ? { home_type: sessionResearchProfile.home_type } : {}),
        ...(sessionResearchProfile?.transport_baseline
          ? { transport_baseline: sessionResearchProfile.transport_baseline }
          : {}),
        ...(sessionResearchProfile?.household ? { household: sessionResearchProfile.household } : {}),
        ...(sessionResearchProfile?.employment_status
          ? { employment_status: sessionResearchProfile.employment_status }
          : {}),
        ...(sessionResearchProfile?.goal ? { goal: sessionResearchProfile.goal } : {}),
      }
      const hermesRaw = sessionResearchProfile?.user_genome?.hermes_memory
      if (hermesRaw && typeof hermesRaw === 'object' && !Array.isArray(hermesRaw)) {
        const skillFile = (hermesRaw as Record<string, unknown>).skill_file
        if (typeof skillFile === 'string' && skillFile.trim()) {
          profileData.hermes_skill_file = skillFile.slice(0, 6000)
        }
      }
      const homeType = request.nextUrl.searchParams.get('home_type')?.trim()
      const transport = request.nextUrl.searchParams.get('transport')?.trim()
      const household = request.nextUrl.searchParams.get('household')?.trim()
      if (homeType) profileData.home_type = homeType
      if (transport) profileData.transport_baseline = transport
      if (household) profileData.household = household
      profileData.postcode = postcode

      const userId = researchUserId
      let loopGenomeSummary: string | undefined
      if (userId) {
        try {
          const genome = await getJourneyAnswersForUser(userId)
          const json = JSON.stringify(genome)
          if (json.length > 4) {
            loopGenomeSummary = json.slice(0, 6000)
            profileData.loop_genome_summary = loopGenomeSummary
          }
        } catch {
          /* ignore */
        }
      }

      const baseCtx = `postcode: ${postcode}, home_type: ${profileData.home_type ?? '—'}, transport: ${profileData.transport_baseline ?? '—'}, household: ${profileData.household ?? '—'}`
      const userContext =
        loopGenomeSummary != null && loopGenomeSummary.length > 0
          ? `${baseCtx}\n\nUser journey answers (JSON from Neon, truncated): ${loopGenomeSummary}`
          : baseCtx

      const localResult = await runZeroResearchWithProfile({
        postcode,
        profileData: Object.keys(profileData).length > 0 ? profileData : undefined,
        persistToNeon: true,
        userId,
        userContext,
      })
      research = {
        markdown: localResult.markdown,
        citations: localResult.citations.map((c) => ({
          source_name: c.source_name,
          url: c.url,
          snippet: c.snippet,
        })),
      }
      await repairResearchResultsMissingHeadlines({
        userId: researchUserId,
        postcode,
        profileData: Object.keys(profileData).length > 0 ? profileData : null,
        limit: 12,
      })
      researchCategoryCoverage = await loadResearchCategoryCoverageResolved(researchUserId, postcode)
      if (researchCategoryCoverage) {
        researchCategoryCoverage = foldCoverageRowsForZone(researchCategoryCoverage)
      }
    }

    let researchMeta: {
      deep_link: string | null
      verified_saving: number | null
      saving_amount_gbp: number | null
      locality_context: string | null
      offer_url: string | null
      source_url: string | null
      /** COALESCE(offer_url, source_url) — use for “Source” / auditor handoff. */
      audit_source_url: string | null
      category: string | null
      architect_prose: string | null
    } | null = null
    if (postcode) {
      const toNum = (v: unknown): number | null => {
        if (v == null) return null
        if (typeof v === 'number' && Number.isFinite(v)) return v
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const selectCols = `deep_link, verified_saving, saving_amount_gbp, locality_context, offer_url, source_url, category, architect_prose`
      type ResearchMetaDbRow = {
        deep_link?: string | null
        verified_saving?: unknown
        saving_amount_gbp?: unknown
        locality_context?: string | null
        offer_url?: string | null
        source_url?: string | null
        category?: string | null
        architect_prose?: string | null
      }
      let researchMetaRow: ResearchMetaDbRow | undefined
      if (researchUserId && postcode.length >= 4) {
        const byUserOrPc = await pool.query(
          `SELECT ${selectCols}
           FROM research_results
           WHERE user_id = $1::uuid
              OR REPLACE(COALESCE(postcode, ''), ' ', '') = $2
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [researchUserId, postcode]
        )
        researchMetaRow = byUserOrPc.rows?.[0]
      } else if (researchUserId) {
        const byUser = await pool.query(
          `SELECT ${selectCols}
           FROM research_results
           WHERE user_id = $1::uuid
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [researchUserId]
        )
        researchMetaRow = byUser.rows?.[0]
      }
      if (!researchMetaRow && postcode.length >= 4) {
        const byPc = await pool.query(
          `SELECT ${selectCols}
           FROM research_results
           WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = $1
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [postcode]
        )
        researchMetaRow = byPc.rows?.[0]
      }
      const offerTrim = (researchMetaRow?.offer_url ?? '').trim()
      const sourceTrim = (researchMetaRow?.source_url ?? '').trim()
      const auditSource =
        offerTrim.length > 0
          ? offerTrim
          : sourceTrim.length > 0
            ? sourceTrim
            : null
      const sav = toNum(researchMetaRow?.saving_amount_gbp)
      const ver = toNum(researchMetaRow?.verified_saving)
      const archProse =
        typeof researchMetaRow?.architect_prose === 'string' && researchMetaRow.architect_prose.trim().length > 0
          ? researchMetaRow.architect_prose.trim().slice(0, 4000)
          : null
      researchMeta = researchMetaRow
        ? {
            deep_link: researchMetaRow.deep_link ?? null,
            verified_saving: ver,
            saving_amount_gbp: sav,
            locality_context: researchMetaRow.locality_context ?? null,
            offer_url: offerTrim.length > 0 ? offerTrim : null,
            source_url: sourceTrim.length > 0 ? sourceTrim : null,
            audit_source_url: auditSource,
            category: researchMetaRow.category?.trim() ?? null,
            architect_prose: archProse,
          }
        : null
    }

    let ratesExtra: Record<string, unknown> = {}
    if (postcode) {
      const homeUnitRates = await resolveLiveUnitRatesForPostcode(postcode)
      const ratesRow = await getLatestResearchUnitRates(postcode)
      ratesExtra = {
        home_unit_rates: homeUnitRates,
        rates_source_url: ratesRow?.source_url ?? null,
      }
    }

    const result = await pool.query(
      `SELECT journey_key, carbon_value, money_value, deep_content_tip, high_saving, scraped_at
       FROM scraped_summary
       ORDER BY journey_key`
    )
    const rows = result.rows || []
    const fromResearch =
      postcode.length >= 4 ? await buildScrapedFromResearchResults(postcode, researchUserId) : null
    const researchHasMoney =
      fromResearch?.some((s) => s.money_value > 0 || Boolean(s.deep_content_tip?.trim())) ?? false

    if (rows.length === 0) {
      if (fromResearch?.length) {
        const payload = {
          scraped: fromResearch,
          source: 'research_results' as const,
          researchMeta,
          ...(researchCategoryCoverage !== undefined
            ? { research_category_coverage: researchCategoryCoverage }
            : {}),
          ...ratesExtra,
        }
        return NextResponse.json(research ? { ...payload, research } : payload)
      }
      if (postcode.length >= 4) {
        const pending = {
          scraped: [] as ScrapedPayloadItem[],
          source: 'pending' as const,
          researchMeta,
          ...(researchCategoryCoverage !== undefined
            ? { research_category_coverage: researchCategoryCoverage }
            : {}),
          ...ratesExtra,
        }
        return NextResponse.json(research ? { ...pending, research } : pending)
      }
      const defaults = fallbackDefaults()
      return NextResponse.json(
        research
          ? {
              scraped: defaults,
              source: 'defaults',
              research,
              researchMeta,
              ...(researchCategoryCoverage !== undefined
                ? { research_category_coverage: researchCategoryCoverage }
                : {}),
              ...ratesExtra,
            }
          : {
              scraped: defaults,
              source: 'defaults',
              researchMeta,
              ...(researchCategoryCoverage !== undefined
                ? { research_category_coverage: researchCategoryCoverage }
                : {}),
              ...ratesExtra,
            }
      )
    }

    const scraped = rows.map((r: any) => ({
      journey_key: r.journey_key,
      scraped_at: r.scraped_at,
      carbon_value: Number(r.carbon_value),
      money_value: Number(r.money_value),
      deep_content_tip: r.deep_content_tip ?? undefined,
      high_saving: Boolean(r.high_saving),
    }))
    const dbHasMoney = scraped.some((s) => s.money_value > 0 || Boolean(s.deep_content_tip?.trim()))
    if (fromResearch?.length && researchHasMoney && !dbHasMoney) {
      const payload = {
        scraped: fromResearch,
        source: 'research_results' as const,
        researchMeta,
        ...(researchCategoryCoverage !== undefined
          ? { research_category_coverage: researchCategoryCoverage }
          : {}),
        ...ratesExtra,
      }
      return NextResponse.json(research ? { ...payload, research } : payload)
    }
    return NextResponse.json(
      research
        ? {
            scraped,
            source: 'database',
            research,
            researchMeta,
            ...(researchCategoryCoverage !== undefined
              ? { research_category_coverage: researchCategoryCoverage }
              : {}),
            ...ratesExtra,
          }
        : {
            scraped,
            source: 'database',
            researchMeta,
            ...(researchCategoryCoverage !== undefined
              ? { research_category_coverage: researchCategoryCoverage }
              : {}),
            ...ratesExtra,
          }
    )
  } catch (e) {
    console.error('[scrape-sync] GET error:', e)
    const defaults = fallbackDefaults()
    return NextResponse.json(
      { scraped: defaults, source: 'defaults', degraded: true, error: 'Failed to load scraped data' },
      { status: 200 }
    )
  }
}

/** Bearer, signed-in session, or browser trigger (`postcode` + valid `user_id`) for POST trigger. */
async function scrapeSyncPostAuthDenied(
  request: NextRequest,
  opts: { allowSessionTrigger: boolean; body?: Record<string, unknown> }
): Promise<NextResponse | null> {
  if (scrapeSyncBearerMatches(request)) return null

  if (opts.allowSessionTrigger) {
    const session = await getSessionFromRequest().catch(() => null)
    if (session?.userId) return null

    const body = opts.body ?? {}
    const postcode =
      typeof body.postcode === 'string' ? body.postcode.replace(/\s+/g, '').trim() : ''
    const researchUserId = resolveResearchUserId(null, request, {
      bodyUserId: typeof body.user_id === 'string' ? body.user_id : null,
    })
    if (postcode.length >= 4 && researchUserId) return null
  }

  const { status, body } = scrapeSyncAuthDeniedResponse()
  return NextResponse.json(body, { status })
}

/**
 * Parse POST body (JSON optional). Query `?postcode=` + `force=true` merges into trigger handshake
 * so zsh `curl` without `-d '{}'` still works (empty body no longer throws).
 */
async function parseScrapeSyncPostBody(request: NextRequest): Promise<Record<string, unknown>> {
  const raw = await request.text().catch(() => '')
  const trimmed = raw.trim()
  let body: Record<string, unknown> = {}
  if (trimmed) {
    body = JSON.parse(trimmed) as Record<string, unknown>
  }

  const sp = request.nextUrl.searchParams
  body = applyScrapeSyncTriggerFlags(sp, body)

  const loopQ =
    (typeof body.question_id === 'string' ? body.question_id.trim() : '') ||
    sp.get('question_id')?.trim() ||
    ''
  const loopA =
    (typeof body.answer_value === 'string' ? String(body.answer_value).trim() : '') ||
    sp.get('answer_value')?.trim() ||
    ''
  if (loopQ) body.question_id = loopQ
  if (loopA) body.answer_value = loopA

  return body
}

/**
 * POST — Upsert crawler payload into scraped_summary (001 Crawler → dashboard).
 * Auth: Bearer `SCRAPER_SECRET` / `CRON_SECRET` / `GATEWAY_TOKEN`, or signed-in session for `trigger` POST.
 * Trigger mode: JSON `{ "trigger": true, "postcode": "SW1A1AA" }` or query `?postcode=&force=true` with empty body.
 */
export async function POST(request: NextRequest) {
  try {
    const id = getClientIdentifier(request)
    const { ok, retryAfter } = checkRateLimit(`scrape-sync:${id}`, SCRAPE_SYNC_MAX_PER_MINUTE)
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await parseScrapeSyncPostBody(request)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const isTrigger = scrapeSyncTriggerRequested(request.nextUrl.searchParams, body)
    const authErr = await scrapeSyncPostAuthDenied(request, {
      allowSessionTrigger: isTrigger,
      body,
    })
    if (authErr) return authErr

    // Airlock handshake mode: trigger local research/scrape without requiring crawler payload.
    if (isTrigger) {
      const postcode = typeof body?.postcode === 'string'
        ? body.postcode.replace(/\s+/g, '').trim().toUpperCase()
        : ''
      if (postcode.length < 4) {
        return NextResponse.json({ error: 'postcode required for trigger' }, { status: 400 })
      }
      const fcErr = firecrawlMissingResponse()
      if (fcErr) return fcErr
      const profileData =
        body?.profileData && typeof body.profileData === 'object' ? (body.profileData as ResearchProfileData) : undefined
      const categoryRaw = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : ''
      /** Postcode-only triggers need a journey category or Zone coverage stays `{}`. */
      const category = categoryRaw.length > 0 ? categoryRaw : 'home'
      const bestOfferHint =
        typeof body?.best_offer_hint === 'string' ? body.best_offer_hint.trim().slice(0, 1200) : ''
      const session = await getSessionFromRequest().catch(() => null)
      const userId = resolveResearchUserId(session?.userId ?? null, request, {
        bodyUserId: typeof body?.user_id === 'string' ? body.user_id : null,
      })
      const sessionResearchProfile =
        userId != null ? await loadDynamicUserProfileForResearch(userId).catch(() => null) : null
      const pd: ResearchProfileData = {
        ...(sessionResearchProfile?.home_type ? { home_type: sessionResearchProfile.home_type } : {}),
        ...(sessionResearchProfile?.transport_baseline
          ? { transport_baseline: sessionResearchProfile.transport_baseline }
          : {}),
        ...(sessionResearchProfile?.household ? { household: sessionResearchProfile.household } : {}),
        ...(sessionResearchProfile?.employment_status
          ? { employment_status: sessionResearchProfile.employment_status }
          : {}),
        ...(sessionResearchProfile?.goal ? { goal: sessionResearchProfile.goal } : {}),
        ...(profileData ?? {}),
        postcode,
      }
      const hermesRaw = sessionResearchProfile?.user_genome?.hermes_memory
      if (hermesRaw && typeof hermesRaw === 'object' && !Array.isArray(hermesRaw)) {
        const skillFile = (hermesRaw as Record<string, unknown>).skill_file
        if (typeof skillFile === 'string' && skillFile.trim()) {
          pd.hermes_skill_file = skillFile.slice(0, 6000)
        }
      }
      let loopGenomeSummary: string | undefined
      if (userId) {
        try {
          const genome = await getJourneyAnswersForUser(userId)
          const json = JSON.stringify(genome)
          if (json.length > 4) {
            loopGenomeSummary = json.slice(0, 6000)
            pd.loop_genome_summary = loopGenomeSummary
          }
        } catch {
          /* ignore */
        }
      }
      const baseCtx = `Profile-first seed — postcode: ${postcode}, home_type: ${pd.home_type ?? '—'}, transport: ${pd.transport_baseline ?? '—'}, household: ${pd.household ?? '—'}`
      let userContext =
        loopGenomeSummary != null && loopGenomeSummary.length > 0
          ? `${baseCtx}\n\nUser journey answers (JSON from Neon, truncated): ${loopGenomeSummary}`
          : baseCtx
      const loopQuestionId =
        typeof body?.question_id === 'string' ? body.question_id.trim() : ''
      const loopAnswer =
        body?.answer_value != null && String(body.answer_value).trim() !== ''
          ? String(body.answer_value).trim()
          : ''
      if (loopQuestionId && loopAnswer) {
        userContext = `${userContext}\n\nLoop answer spawn:\nquestion_id: ${loopQuestionId}\nanswer: ${loopAnswer}`
      }
      if (category) {
        userContext = `${userContext}\n\nSolo Focus scrape-sync category: ${category}`
      }
      if (bestOfferHint.length > 0) {
        userContext = `${userContext}\n\nBEST OFFER / ACTION URL PRIORITY:\n${bestOfferHint}`
      }
      const lifestyleShift = isLifestyleShiftMode(body)
      if (lifestyleShift) {
        userContext = `${userContext}\n\nMODE: lifestyle_shift — pattern arbitrage (rail vs flight, EV swap, local holidays). Reject generic homepage URLs; require deep-linked UK portals only.`
      }
      const research = await runTriggerResearchForCategory({
        postcode,
        profileData: Object.keys(pd).length > 0 ? pd : undefined,
        userId,
        userContext,
        category,
        lifestyleShift,
      })
      const headlinesRepaired = await repairResearchResultsMissingHeadlines({
        userId,
        postcode,
        profileData: pd,
        limit: 4,
      })
      const coverage = await loadResearchCategoryCoverageByPostcode(postcode)
      const categoriesWithInsight = Object.entries(coverage).filter(
        ([, row]) => row.insightReady || (row.latestSavingGbp != null && row.latestSavingGbp > 0)
      ).length
      const citationsPayload = research.citations.map((c) => ({
        source_name: c.source_name,
        url: c.url,
        snippet: c.snippet,
      }))
      const journeyForShield = (
        JOURNEY_ORDER.includes(category as JourneyId) ? category : 'home'
      ) as JourneyId
      const loopRec =
        loopQuestionId && loopAnswer
          ? getDiscoveryRecommendation(journeyForShield, loopQuestionId, loopAnswer)
          : null
      const urlShield =
        lifestyleShift || body.is_achievement_card === true
          ? urlShieldForAchievement(citationsPayload, journeyForShield, loopRec)
          : null
      let achievement: Awaited<ReturnType<typeof maybeBirthAchievementFromScrapeSync>> = null
      let achievementError: string | null = null
      try {
        achievement = await maybeBirthAchievementFromScrapeSync({
          body,
          userId,
          category,
          loopQuestionId,
          loopAnswer,
          markdown: research.markdown,
          citations: citationsPayload,
        })
      } catch (err) {
        achievementError =
          err instanceof Error ? err.message.slice(0, 240) : 'achievement-birth-failed'
        console.error('[scrape-sync] achievement birth failed:', err)
      }
      return NextResponse.json({
        ok: true,
        mode: lifestyleShift ? 'lifestyle_shift' : 'trigger',
        lifestyle_mode: lifestyleShift ? 'lifestyle_shift' : null,
        category,
        headlinesRepaired,
        categoriesWithInsight,
        is_achievement_card: Boolean(achievement?.achievement_card),
        parent_answer_id: achievement?.parent_answer_id ?? null,
        url_shield: achievement?.url_shield ?? urlShield,
        achievement_card: achievement?.achievement_card ?? null,
        achievement_card_summary: achievement?.achievement_card
          ? {
              id: achievement.achievement_card.id,
              title: achievement.achievement_card.title,
              journey_key: achievement.achievement_card.journey_key,
            }
          : null,
        achievement: achievement
          ? { persisted: achievement.persisted, id: achievement.achievement_card?.id }
          : null,
        ...(achievementError ? { achievement_error: achievementError } : {}),
        research: {
          markdown: research.markdown,
          citations: citationsPayload,
        },
      })
    }

    const rawItems = Array.isArray(body.scraped)
      ? body.scraped
      : Array.isArray(body.scrapedData)
        ? body.scrapedData
        : body.items
    const rawArr = Array.isArray(rawItems) ? rawItems : []
    /** Placeholder rows (`{ category, status }` only) — Hermes pulse, not crawler upsert. */
    const items: ScrapedPayloadItem[] = rawArr.filter((row): row is ScrapedPayloadItem => {
      if (!row || typeof row !== 'object') return false
      const jk = (row as ScrapedPayloadItem).journey_key
      return typeof jk === 'string' && JOURNEY_ORDER.includes(jk as JourneyId)
    })

    if (items.length === 0) {
      if (scrapeSyncTriggerRequested(request.nextUrl.searchParams, body)) {
        return NextResponse.json(
          {
            error: 'Trigger handshake incomplete',
            hint: 'POST with trigger flag was recognized but trigger branch did not run — retry with ?postcode=YOUR_PC&force=true',
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        {
          error: 'Missing scraped array',
          hint: 'Send scraped[] for crawler upsert, or trigger mode: ?postcode=…&force=true with Authorization Bearer',
        },
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!JOURNEY_ORDER.includes(item.journey_key)) continue
      await pool.query(
        `INSERT INTO scraped_summary (journey_key, carbon_value, money_value, deep_content_tip, high_saving, scraped_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (journey_key)
         DO UPDATE SET
           carbon_value = EXCLUDED.carbon_value,
           money_value = EXCLUDED.money_value,
           deep_content_tip = EXCLUDED.deep_content_tip,
           high_saving = EXCLUDED.high_saving,
           scraped_at = NOW()`,
        [
          item.journey_key,
          Number(item.carbon_value),
          Number(item.money_value),
          item.deep_content_tip ?? null,
          Boolean(item.high_saving),
        ]
      )
    }

    return NextResponse.json({ ok: true, updated: items.length })
  } catch (e) {
    console.error('[scrape-sync] POST error:', e)
    const detail = e instanceof Error ? e.message.slice(0, 280) : String(e).slice(0, 280)
    return NextResponse.json(
      { error: 'Failed to sync scraped data', detail },
      { status: 500 }
    )
  }
}
