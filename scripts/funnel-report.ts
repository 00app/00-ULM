/**
 * Funnel report CLI — query analytics_events (requires DATABASE_URL).
 * Run: npm run funnel:report
 */
import { buildFunnelReport, funnelReportSql } from '../lib/analytics/funnelReport'

const days = Number(process.argv[2] ?? 7)

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[funnel-report] DATABASE_URL unset — cannot query Neon')
    process.exit(1)
  }

  try {
    const report = await buildFunnelReport(days)
    console.log(JSON.stringify(report, null, 2))
    console.log('\n-- SQL reference --\n')
    console.log(funnelReportSql(days))
  } catch (e) {
    console.error('[funnel-report] FAILED', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

void main()
