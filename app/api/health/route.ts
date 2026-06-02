import { NextResponse } from 'next/server'
import { isDatabaseConfigured, pingDatabase } from '@/lib/db'
import { resolveFirecrawlApiKey, resolveFirecrawlEnvSlot } from '@/lib/sentinel/api-config'
import {
  bucketFailoverStatus,
  shouldSkipFirecrawlScrape,
  shouldSkipGeminiInBucket,
} from '@/lib/intelligence/scrapeBoundaries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function providerSnapshot() {
  const bucket = bucketFailoverStatus()
  const skipGemini = shouldSkipGeminiInBucket()
  const researchProviderOrder: string[] = []
  if (bucket.providers.groq) researchProviderOrder.push(`groq:${process.env.GROQ_MODEL?.trim() || 'llama-3.1-8b-instant'}`)
  if (bucket.providers.mistral) researchProviderOrder.push('mistral')
  if (bucket.providers.openrouter) researchProviderOrder.push('openrouter')
  if (bucket.providers.gemini) {
    researchProviderOrder.push(
      `gemini:${process.env.GEMINI_RESEARCH_MODEL?.trim() || process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-2.5-flash'}`
    )
  }
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    firecrawl: Boolean(resolveFirecrawlApiKey()) && !shouldSkipFirecrawlScrape(),
    firecrawlEnv: resolveFirecrawlEnvSlot(),
    skipFirecrawl: shouldSkipFirecrawlScrape(),
    geminiZoneModel: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-2.5-flash',
    bucketFailover: bucket.enabled,
    bucketSkipGemini: skipGemini,
    preferMechanicalTriplet: bucket.preferMechanicalTriplet,
    researchProviderOrder,
    researchPrimary: researchProviderOrder[0] ?? (bucket.enabled ? 'none' : 'direct-gemini'),
    researchForceDirectGemini:
      process.env.RESEARCH_FORCE_DIRECT_GEMINI?.trim().toLowerCase() !== 'false',
  }
}

/**
 * Full check: DB ping. Use `?live=1` for HTTP 200 liveness only (no DB) — deploy probes / build smoke.
 */
export async function GET(request: Request) {
  const live = new URL(request.url).searchParams.get('live')
  if (live === '1') {
    return NextResponse.json({ status: 'ok', probe: 'liveness', providers: providerSnapshot() })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'not_configured',
        providers: providerSnapshot(),
        hint: 'Run vercel pull --yes --environment=production && cp .vercel/.env.production.local .env.local',
      },
      { status: 503 }
    )
  }

  try {
    const ping = await pingDatabase()
    if (!ping.ok) {
      throw new Error('Database ping failed')
    }
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latencyMs: ping.latencyMs,
      providers: providerSnapshot(),
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        providers: providerSnapshot(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
