/**
 * Scrape-sync API
 * GET: returns current scraped values for the dashboard (from DB or UK 2026 defaults).
 *    Optional ?postcode= triggers ZeroResearch (Firecrawl / Gemini) for fresh regional grant data; response includes research.citations when present.
 * POST: accepts 001 Crawler payload and upserts into scraped_summary for hero totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getJourneyAnswersForUser } from '@/lib/db/neon'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import { runZeroResearchWithProfile, type ResearchProfileData } from '@/lib/agents/researchAgent'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { resolveLiveUnitRatesForPostcode } from '@/lib/brains/liveEconomy'
import { getLatestResearchUnitRates } from '@/lib/db/neon'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
const SCRAPE_SYNC_MAX_PER_MINUTE = 24

interface ScrapedPayloadItem {
  journey_key: JourneyId
  carbon_value: number
  money_value: number
  deep_content_tip?: string
  high_saving?: boolean
}

async function loadResearchCategoryCoverage(userId: string): Promise<Record<string, ResearchCategoryCoverageRow>> {
  const out: Record<string, ResearchCategoryCoverageRow> = {}
  const toNum = (v: unknown): number | null => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  try {
    const cov = await pool.query<{
      cat: string
      architect_prose: string | null
      offer_url: string | null
      source_url: string | null
      saving_amount_gbp: unknown
      verified_saving: unknown
      verified: unknown
    }>(
      `SELECT DISTINCT ON (lower(trim(rr.category)))
          lower(trim(rr.category)) AS cat,
          rr.architect_prose,
          rr.offer_url,
          rr.source_url,
          rr.saving_amount_gbp,
          rr.verified_saving,
          rr.verified
       FROM research_results rr
       WHERE rr.user_id = $1::uuid AND rr.category IS NOT NULL AND btrim(rr.category) <> ''
       ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST`,
      [userId]
    )
    for (const row of cov.rows) {
      const k = String(row.cat || '').trim().toLowerCase()
      if (!k) continue
      const prose = typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
      const offer = typeof row.offer_url === 'string' ? row.offer_url.trim() : ''
      const src = typeof row.source_url === 'string' ? row.source_url.trim() : ''
      const sav = toNum(row.saving_amount_gbp)
      const ver = toNum(row.verified_saving)
      const insightReady = prose.length > 0
      const hasOffer = offer.startsWith('http')
      const hasSrc = src.startsWith('http')
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
      }
    }
  } catch (err) {
    console.warn('[scrape-sync] research_category_coverage:', err)
  }
  return out
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
  const fallbackDefaults = () =>
    JOURNEY_ORDER.map((key) => {
      const d = UK_2026_MONEY_LEAD[key]
      return {
        journey_key: key,
        scraped_at: new Date().toISOString(),
        carbon_value: d.carbon_value,
        money_value: d.money_value,
        deep_content_tip: d.crawler_tip ?? null,
        high_saving: false,
      }
    })
  try {
    const session = await getSessionFromRequest().catch(() => null)
    const sessionUserId = session?.userId ?? null
    const researchCategoryCoverage =
      sessionUserId != null ? await loadResearchCategoryCoverage(sessionUserId) : undefined

    const postcodeRaw = request.nextUrl.searchParams.get('postcode')?.trim() || null
    const postcode = postcodeRaw ? postcodeRaw.replace(/\s+/g, '').toUpperCase() : null
    if (postcode && postcode.length > 12) {
      return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
    }
    let research: { markdown: string; citations: Array<{ source_name: string; url: string; snippet?: string }> } | undefined

    if (postcode) {
      const profileData: ResearchProfileData = {}
      const homeType = request.nextUrl.searchParams.get('home_type')?.trim()
      const transport = request.nextUrl.searchParams.get('transport')?.trim()
      const household = request.nextUrl.searchParams.get('household')?.trim()
      if (homeType) profileData.home_type = homeType
      if (transport) profileData.transport_baseline = transport
      if (household) profileData.household = household
      profileData.postcode = postcode

      const userId = sessionUserId
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
      if (sessionUserId) {
        const byUser = await pool.query(
          `SELECT ${selectCols}
           FROM research_results
           WHERE user_id = $1::uuid
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1`,
          [sessionUserId]
        )
        researchMetaRow = byUser.rows?.[0]
      }
      if (!researchMetaRow) {
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

    if (rows.length === 0) {
      // Fallback: UK 2026 money-lead defaults so dashboard still has hero values
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

const MIN_SCRAPER_SECRET_LENGTH = 16

/**
 * POST — Upsert crawler payload into scraped_summary (001 Crawler → dashboard).
 * In production, SCRAPER_SECRET must be set (min 16 chars) and x-scraper-key must match.
 * In non-production, if SCRAPER_SECRET is set we still validate the key; if unset, POST is allowed for local dev only.
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
    const secret = process.env.SCRAPER_SECRET?.trim()
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction) {
      if (!secret || secret.length < MIN_SCRAPER_SECRET_LENGTH) {
        return NextResponse.json({ error: 'Scraper not configured' }, { status: 503 })
      }
      const key = request.headers.get('x-scraper-key')
      if (key !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (secret) {
      // Non-production but secret set: still require matching key
      const key = request.headers.get('x-scraper-key')
      if (key !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    const body = await request.json()

    // Airlock handshake mode: trigger local research/scrape without requiring crawler payload.
    if (body?.trigger === true) {
      const postcode = typeof body?.postcode === 'string'
        ? body.postcode.replace(/\s+/g, '').trim().toUpperCase()
        : ''
      if (postcode.length < 4) {
        return NextResponse.json({ error: 'postcode required for trigger' }, { status: 400 })
      }
      const profileData =
        body?.profileData && typeof body.profileData === 'object' ? (body.profileData as ResearchProfileData) : undefined
      const categoryRaw = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : ''
      const category = categoryRaw.length > 0 ? categoryRaw : null
      const session = await getSessionFromRequest().catch(() => null)
      const userId = session?.userId ?? null
      const pd: ResearchProfileData = { ...(profileData ?? {}), postcode }
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
      const baseCtx = `postcode: ${postcode}, home_type: ${pd.home_type ?? '—'}, transport: ${pd.transport_baseline ?? '—'}, household: ${pd.household ?? '—'}`
      let userContext =
        loopGenomeSummary != null && loopGenomeSummary.length > 0
          ? `${baseCtx}\n\nUser journey answers (JSON from Neon, truncated): ${loopGenomeSummary}`
          : baseCtx
      if (category) {
        userContext = `${userContext}\n\nSolo Focus scrape-sync category: ${category}`
      }
      const research = await runZeroResearchWithProfile({
        postcode,
        profileData: Object.keys(pd).length > 0 ? pd : undefined,
        persistToNeon: true,
        userId,
        userContext,
        category,
      })
      return NextResponse.json({
        ok: true,
        mode: 'trigger',
        research: {
          markdown: research.markdown,
          citations: research.citations.map((c) => ({
            source_name: c.source_name,
            url: c.url,
            snippet: c.snippet,
          })),
        },
      })
    }

    const items: ScrapedPayloadItem[] = Array.isArray(body.scraped) ? body.scraped : body.items ?? []

    if (items.length === 0) {
      return NextResponse.json({ error: 'Missing scraped array' }, { status: 400 })
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
    return NextResponse.json({ error: 'Failed to sync scraped data' }, { status: 500 })
  }
}
