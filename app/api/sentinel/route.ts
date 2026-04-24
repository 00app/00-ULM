import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { runSentinelBrainRefresh } from '@/lib/agents/sentinel'
import { syncUserZone } from '@/lib/sentinel/runner'

export const runtime = 'nodejs'

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

function hasRuralGrantSignal(markdown: string, citations: Array<{ source_name?: string; url?: string; snippet?: string }>): boolean {
  const blob = `${markdown} ${citations.map((c) => `${c.source_name ?? ''} ${c.url ?? ''} ${c.snippet ?? ''}`).join(' ')}`.toLowerCase()
  return /rural heat|boiler upgrade scheme|bus grant|home energy scotland|warm homes/.test(blob)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const priorities = (Array.isArray(body?.priorities) ? body.priorities : []) as IncomingPriority[]
    const systemPrompt = typeof body?.system_prompt === 'string' ? body.system_prompt : ''
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
    const liveImpact = sentinelBrain.liveImpact

    await syncUserZone({
      userId: session.userId,
      location: postcode,
      genome,
      appOrigin: request.nextUrl.origin,
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
    const injectedPrompt =
      "You now have the 'Live-Impact Skill'. Before generating tips, call this skill to get the EXACT UK energy rates for April 2026. Use these to calculate precise £ savings for the user's profile."
    const sentinelInstruction =
      "You are the Sentinel. You must now use the Live-Impact Skill to fetch the current UK grid intensity (currently ~66g/kWh in London). If the grid is Low (<50g), trigger the Grid Pulse animation on the Carbon card. Use Firecrawl to find Rural Heat Grants if the user's postcode is in a remote region (e.g., KW1)."

    const isRemoteRegion = REMOTE_POSTCODE_PREFIX.test(postcode)
    let grantFound = Boolean(sentinelBrain.grant.found && isRemoteRegion)
    if (runScrapeSync && postcode.length >= 4) {
      try {
        const origin = request.nextUrl.origin
        const scrapeRes = await fetch(`${origin}/api/scrape-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
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
               'system_prompt', $3::text,
               'prompt_injection', $4::text,
               'sentinel_instruction', $5::text,
               'region', $6::text,
               'live_impact', $7::jsonb,
               'grant_found', $8::boolean,
               'grid_low', $9::boolean,
               'model', $10::text,
               'tool_calling', $11::boolean,
               'firecrawl_grant', $12::jsonb,
               'updated_at', NOW()
             )
           )
       WHERE id = $1`,
      [
        session.userId,
        JSON.stringify(tunedPriorities),
        systemPrompt,
        injectedPrompt,
        sentinelInstruction,
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
      prompt_injection: injectedPrompt,
      sentinel_instruction: sentinelInstruction,
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
