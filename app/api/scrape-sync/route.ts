/**
 * S UPDATE — Scrape-sync API
 * GET: returns current scraped values for the dashboard (from DB or UK 2026 defaults).
 *    Optional ?postcode= triggers OpenClaw/ZeroResearch for fresh regional grant data; response includes research.citations when present.
 * POST: accepts 001 Crawler payload and upserts into scraped_summary for hero totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import { runZeroResearchWithProfile, type ResearchProfileData } from '@/lib/agents/researchAgent'

export const dynamic = 'force-dynamic'

interface ScrapedPayloadItem {
  journey_key: JourneyId
  carbon_value: number
  money_value: number
  deep_content_tip?: string
  high_saving?: boolean
}

/** GET — Return scraped data for dashboard (buildUserImpact options.scraped). Optional ?postcode= polls OpenClaw for fresh regional data. */
export async function GET(request: NextRequest) {
  try {
    const postcode = request.nextUrl.searchParams.get('postcode')?.trim() || null
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

      const localResult = await runZeroResearchWithProfile({
        postcode,
        profileData: Object.keys(profileData).length > 0 ? profileData : undefined,
        persistToNeon: true,
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

    const result = await pool.query(
      `SELECT journey_key, carbon_value, money_value, deep_content_tip, high_saving, scraped_at
       FROM scraped_summary
       ORDER BY journey_key`
    )
    const rows = result.rows || []

    if (rows.length === 0) {
      // Fallback: UK 2026 money-lead defaults so dashboard still has hero values
      const defaults = JOURNEY_ORDER.map((key) => {
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
      return NextResponse.json(
        research ? { scraped: defaults, source: 'defaults', research } : { scraped: defaults, source: 'defaults' }
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
      research ? { scraped, source: 'database', research } : { scraped, source: 'database' }
    )
  } catch (e) {
    console.error('[scrape-sync] GET error:', e)
    return NextResponse.json({ error: 'Failed to load scraped data' }, { status: 500 })
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
      const postcode = typeof body?.postcode === 'string' ? body.postcode.trim() : ''
      if (postcode.length < 4) {
        return NextResponse.json({ error: 'postcode required for trigger' }, { status: 400 })
      }
      const profileData = body?.profileData && typeof body.profileData === 'object' ? body.profileData : undefined
      const research = await runZeroResearchWithProfile({
        postcode,
        profileData,
        persistToNeon: true,
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
