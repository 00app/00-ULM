/**
 * S UPDATE — Scrape-sync API
 * GET: returns current scraped values for the dashboard (from DB or UK 2026 defaults).
 * POST: accepts 001 Crawler payload and upserts into scraped_summary for hero totals.
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'

export const dynamic = 'force-dynamic'

interface ScrapedPayloadItem {
  journey_key: JourneyId
  carbon_value: number
  money_value: number
  deep_content_tip?: string
  high_saving?: boolean
}

/** GET — Return scraped data for dashboard (buildUserImpact options.scraped). */
export async function GET() {
  try {
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
      return NextResponse.json({ scraped: defaults, source: 'defaults' })
    }

    const scraped = rows.map((r: any) => ({
      journey_key: r.journey_key,
      scraped_at: r.scraped_at,
      carbon_value: Number(r.carbon_value),
      money_value: Number(r.money_value),
      deep_content_tip: r.deep_content_tip ?? undefined,
      high_saving: Boolean(r.high_saving),
    }))
    return NextResponse.json({ scraped, source: 'database' })
  } catch (e) {
    console.error('[scrape-sync] GET error:', e)
    return NextResponse.json({ error: 'Failed to load scraped data' }, { status: 500 })
  }
}

/** POST — Upsert crawler payload into scraped_summary (001 Crawler → dashboard). */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SCRAPER_SECRET
    if (secret) {
      const key = request.headers.get('x-scraper-key')
      if (key !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    const body = await request.json()
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
