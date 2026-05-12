import { NextResponse } from 'next/server'
import pool from '@/lib/db'

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
    const result = await pool.query('SELECT NOW() as time')
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].time,
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
