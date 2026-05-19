import { NextResponse } from 'next/server'
import { pingDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Full check: DB ping. Use `?live=1` for HTTP 200 liveness only (no DB) — deploy probes / build smoke.
 */
export async function GET(request: Request) {
  const live = new URL(request.url).searchParams.get('live')
  if (live === '1') {
    return NextResponse.json({ status: 'ok', probe: 'liveness' })
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
