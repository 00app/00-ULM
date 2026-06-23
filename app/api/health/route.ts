import { NextResponse } from 'next/server'
import { isDatabaseConfigured, pingDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public liveness + DB ping only — no provider / bucket surface map (see /api/health/diagnostics).
 * Use `?live=1` for deploy probes without DB.
 */
export async function GET(request: Request) {
  const live = new URL(request.url).searchParams.get('live')
  if (live === '1') {
    return NextResponse.json({ status: 'ok', probe: 'liveness' })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        status: 'degraded',
        database: 'not_configured',
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
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
