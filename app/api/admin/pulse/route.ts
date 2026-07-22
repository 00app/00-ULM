import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import type { PulseMetric } from '@/lib/adminPulse'
import { FIRECRAWL_API_KEY } from '@/lib/sentinel/api-config'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'
/** Matches {@link app/api/zai/route.ts} primary model for a real key/network check. */
const GEMINI_PULSE_MODEL = process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash'
/** This route triggers a real, billed Gemini call and Firecrawl scrape on every hit — cap it
 *  like the other AI-triggering routes so a leaked GATEWAY_TOKEN/ADMIN_PASSWORD or a misconfigured
 *  middleware matcher can't be looped for unbounded external API spend. */
const PULSE_MAX_PER_MINUTE = 6

/**
 * Live dependency probe: Neon SQL, Gemini completion, Firecrawl scrape.
 * Auth: Basic (same as root `proxy`), signed-in session (cookie), or `GATEWAY_TOKEN` bearer.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  if (!session && !gatewayTokenMatches(request) && !adminBasicAuthMatches(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`admin-pulse:${id}`, PULSE_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    )
  }

  const timestamp = new Date().toISOString()
  const neon: PulseMetric = { state: 'offline' }
  const gemini: PulseMetric = { state: 'skipped' }
  const firecrawl: PulseMetric = { state: 'skipped' }

  try {
    const t0 = Date.now()
    await pool.query('SELECT 1')
    neon.state = 'online'
    neon.latencyMs = Math.max(0, Date.now() - t0)
  } catch (e) {
    neon.state = 'offline'
    neon.detail = e instanceof Error ? e.message : 'database error'
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (!geminiKey) {
    gemini.state = 'skipped'
    gemini.detail = 'GEMINI_API_KEY unset'
  } else {
    try {
      const t0 = Date.now()
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({
        model: GEMINI_PULSE_MODEL,
        generationConfig: { maxOutputTokens: 8 },
      })
      await model.generateContent('ping')
      gemini.state = 'online'
      gemini.latencyMs = Math.max(0, Date.now() - t0)
    } catch (e) {
      gemini.state = 'offline'
      gemini.detail = e instanceof Error ? e.message : 'gemini error'
    }
  }

  const fcKey = FIRECRAWL_API_KEY
  if (!fcKey) {
    firecrawl.state = 'skipped'
    firecrawl.detail = 'FIRE_CRAWL_KEY_2 unset'
  } else {
    try {
      const t0 = Date.now()
      const res = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fcKey}`,
        },
        body: JSON.stringify({
          url: 'https://example.com',
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      })
      firecrawl.latencyMs = Math.max(0, Date.now() - t0)
      if (res.ok) {
        firecrawl.state = 'online'
      } else {
        firecrawl.state = 'offline'
        let bodyHint = ''
        try {
          const j = (await res.json()) as { error?: string; message?: string }
          bodyHint = j?.error || j?.message || ''
        } catch {
          /* ignore */
        }
        firecrawl.detail = bodyHint ? `HTTP ${res.status}: ${bodyHint.slice(0, 120)}` : `HTTP ${res.status}`
      }
    } catch (e) {
      firecrawl.state = 'offline'
      firecrawl.detail = e instanceof Error ? e.message : 'firecrawl error'
    }
  }

  return NextResponse.json({
    timestamp,
    neon,
    gemini,
    firecrawl,
  })
}
