export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { runSentinelBrainRefresh } from '@/lib/agents/sentinel'
import { syncUserZone } from '@/lib/sentinel/runner'
import { configuredScrapeSyncBearerKeys } from '@/lib/intelligence/scrapeSyncAuth'

export const runtime = 'nodejs'
export const maxDuration = 60

type IncomingPriority = {
  id?: string
  journeyKey?: string
  title?: string
  savingsGbp?: number
  carbonKg?: number
  gainPercent?: number
  bearTip?: string
  wolfTip?: string
}

const REMOTE_POSTCODE_PREFIX = /^(KW|IV|HS|ZE|PH|PA|AB|TR|LL)/i

function resolveAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!configured) return request.nextUrl.origin
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  try {
    return new URL(withProtocol).origin
  } catch {
    return request.nextUrl.origin
  }
}

function hasRuralGrantSignal(markdown: string, citations: Array<{ source_name?: string; url?: string; snippet?: string }>): boolean {
  const blob = `${markdown} ${citations.map((c) => `${c.source_name ?? ''} ${c.url ?? ''} ${c.snippet ?? ''}`).join(' ')}`.toLowerCase()
  return /rural heat|boiler upgrade scheme|bus grant|home energy scotland|warm homes/.test(blob)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const priorities = (Array.isArray(body?.priorities) ? body.priorities : []) as IncomingPriority[]

    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({
        priorities,
        last_refreshed: new Date().toISOString(),
        guest: true,
        grid_low: false,
        grant_found: false,
      })
    }
    const region = typeof body?.region === 'string' ? body.region.trim() : ''
    const runScrapeSync = Boolean(body?.run_scrape_sync)

    const userRow = await pool.query<{ postcode: string | null; user_genome: Record<string, unknown> | null }>(
      'SELECT postcode, user_genome FROM users WHERE id = $1 LIMIT 1',
      [session.userId]
    )
    const postcode = (userRow.rows[0]?.postcode ?? '').replace(/\s+/g, '').toUpperCase()
    const genome = userRow.rows[0]?.user_genome ?? {}
    const sentinelBrain = await runSentinelBrainRefresh({
      region,
      postcode,
      runScrapeSync,
    })
    console.log(`[sentinel] model=${sentinelBrain.model} fallback=${sentinelBrain.model === 'mechanical'}`)
    const liveImpact = sentinelBrain.liveImpact

    const appOrigin = resolveAppOrigin(request)
    await syncUserZone({
      userId: session.userId,
      location: postcode,
      genome,
      appOrigin,
    })

    const baselineCost = liveImpact?.homeIdle24h?.totalCostGbp ?? 0
    const tunedPriorities = priorities.map((p) => {
      const baseSavings = typeof p.savingsGbp === 'number' ? p.savingsGbp : 0
      const liveAdjusted = Number((baseSavings + baselineCost * 4).toFixed(2))
      return {
        ...p,
        savingsGbp: liveAdjusted,
      }
    })
    const isRemoteRegion = REMOTE_POSTCODE_PREFIX.test(postcode)
    let grantFound = Boolean(sentinelBrain.grant.found && isRemoteRegion)
    if (runScrapeSync && postcode.length >= 4) {
      try {
        const bearerKeys = configuredScrapeSyncBearerKeys()
        const scrapeHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') ?? '',
        }
        if (bearerKeys[0]) scrapeHeaders.Authorization = `Bearer ${bearerKeys[0]}`
        const scrapeRes = await fetch(`${appOrigin}/api/scrape-sync`, {
          method: 'POST',
          headers: scrapeHeaders,
          body: JSON.stringify({ trigger: true, postcode }),
        })
        if (scrapeRes.ok) {
          const scrapeData = (await scrapeRes.json().catch(() => ({}))) as {
            research?: { markdown?: string; citations?: Array<{ source_name?: string; url?: string; snippet?: string }> }
          }
          const markdown = scrapeData?.research?.markdown ?? ''
          const citations = Array.isArray(scrapeData?.research?.citations) ? scrapeData.research.citations : []
          grantFound = isRemoteRegion && hasRuralGrantSignal(markdown, citations)
        }
      } catch {
        // non-fatal; sentinel can still proceed with live impact data
      }
    }

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_refreshed TIMESTAMPTZ')
    await pool.query(
      `UPDATE users
       SET last_refreshed = NOW(),
           user_genome = COALESCE(user_genome, '{}'::jsonb) || jsonb_build_object(
             'sentinel',
             jsonb_build_object(
               'priorities', $2::jsonb,
               'region', $3::text,
               'live_impact', $4::jsonb,
               'grant_found', $5::boolean,
               'grid_low', $6::boolean,
               'model', $7::text,
               'tool_calling', $8::boolean,
               'firecrawl_grant', $9::jsonb,
               'updated_at', NOW()
             )
           )
       WHERE id = $1`,
      [
        session.userId,
        JSON.stringify(tunedPriorities),
        region || null,
        JSON.stringify(liveImpact ?? null),
        grantFound,
        (liveImpact?.grid?.intensityGPerKwh ?? 999) < 50,
        sentinelBrain.model,
        sentinelBrain.tool_calling,
        JSON.stringify(sentinelBrain.grant),
      ]
    )
    const refreshed = await pool.query<{ last_refreshed: string }>(
      'SELECT last_refreshed::text AS last_refreshed FROM users WHERE id = $1',
      [session.userId]
    )
    return NextResponse.json({
      ok: true,
      last_refreshed: refreshed.rows[0]?.last_refreshed ?? new Date().toISOString(),
      priorities: tunedPriorities,
      liveImpact,
      grant_found: grantFound,
      firecrawl_grant: sentinelBrain.grant,
      model: sentinelBrain.model,
      tool_calling: sentinelBrain.tool_calling,
      grid_low: (liveImpact?.grid?.intensityGPerKwh ?? 999) < 50,
    })
  } catch (error) {
    console.error('[sentinel] POST error:', error)
    return NextResponse.json({ error: 'Failed to sync sentinel' }, { status: 500 })
  }
}
