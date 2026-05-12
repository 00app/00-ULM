import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'
import type { PulseMetric } from '@/lib/adminPulse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'
/** Matches {@link app/api/zai/route.ts} primary model for a real key/network check. */
const GEMINI_PULSE_MODEL = 'gemini-2.5-flash-lite'

function hasGatewayAuth(request: NextRequest): boolean {
  const expected =
    process.env.GATEWAY_TOKEN?.trim() ||
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!expected) return false
  const got =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim() ??
    request.headers.get('x-gateway-token')?.trim()
  return got === expected
}

/**
 * Live dependency probe: Neon SQL, Gemini completion, Firecrawl scrape.
 * Auth: Basic (same as root `proxy`), signed-in session (cookie), or bearer tokens like `/api/health/diagnostics`.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  if (!session && !hasGatewayAuth(request) && !adminBasicAuthMatches(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const fcKey = process.env.FIRECRAWL_API_KEY?.trim()
  if (!fcKey) {
    firecrawl.state = 'skipped'
    firecrawl.detail = 'FIRECRAWL_API_KEY unset'
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
