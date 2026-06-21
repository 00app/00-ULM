import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import { buildFunnelReport, funnelReportSql } from '@/lib/analytics/funnelReport'
import { rateLimitBackendLabel } from '@/lib/rateLimitDistributed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Funnel telemetry — session counts per event_type from analytics_events.
 * Auth: same as /api/admin/pulse (session, gateway bearer, or admin basic).
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest().catch(() => null)
  if (!session && !gatewayTokenMatches(request) && !adminBasicAuthMatches(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const daysRaw = request.nextUrl.searchParams.get('days')
  const days = daysRaw ? Number(daysRaw) : 7
  const format = request.nextUrl.searchParams.get('format')

  if (format === 'sql') {
    return NextResponse.json({
      sql: funnelReportSql(Number.isFinite(days) ? days : 7),
      rateLimitBackend: rateLimitBackendLabel(),
    })
  }

  try {
    const report = await buildFunnelReport(Number.isFinite(days) ? days : 7)
    return NextResponse.json({
      ...report,
      rateLimitBackend: rateLimitBackendLabel(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'funnel query failed' },
      { status: 500 }
    )
  }
}
