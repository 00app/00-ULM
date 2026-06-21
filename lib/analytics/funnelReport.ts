/**
 * Funnel telemetry queries — `analytics_events` table (Phase 0).
 */
import pool from '@/lib/db'
import { FUNNEL_EVENT_NAMES, type FunnelEventName } from '@/lib/analytics/funnelEvents'

export type FunnelEventCount = {
  event_type: string
  sessions: number
  events: number
}

export type FunnelReport = {
  windowDays: number
  generatedAt: string
  backend: string
  eventCounts: FunnelEventCount[]
  conversion: Partial<Record<FunnelEventName, number>>
}

const FUNNEL_STEPS: FunnelEventName[] = [
  'intro_complete',
  'profile_complete',
  'summary_enter_zone',
  'zone_ready',
  'solo_focus_open',
  'cta_click',
]

export async function buildFunnelReport(windowDays = 7): Promise<FunnelReport> {
  const days = Math.min(90, Math.max(1, Math.round(windowDays)))
  const eventCountsRes = await pool.query<FunnelEventCount>(
    `SELECT
       event_type,
       COUNT(*)::int AS events,
       COUNT(DISTINCT session_id)::int AS sessions
     FROM analytics_events
     WHERE timestamp >= (NOW() AT TIME ZONE 'utc') - ($1::int || ' days')::interval
     GROUP BY event_type
     ORDER BY events DESC`,
    [days]
  )

  const conversion: Partial<Record<FunnelEventName, number>> = {}
  for (const step of FUNNEL_STEPS) {
    const row = eventCountsRes.rows.find((r) => r.event_type === step)
    conversion[step] = row?.sessions ?? 0
  }

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    backend: 'neon:analytics_events',
    eventCounts: eventCountsRes.rows,
    conversion,
  }
}

export function funnelReportSql(windowDays = 7): string {
  return `-- Funnel counts (last ${windowDays} days)
SELECT event_type, COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
FROM analytics_events
WHERE timestamp >= NOW() - INTERVAL '${windowDays} days'
GROUP BY event_type
ORDER BY events DESC;

-- Known funnel steps: ${FUNNEL_EVENT_NAMES.join(', ')}`
}
