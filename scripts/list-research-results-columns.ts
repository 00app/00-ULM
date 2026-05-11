/**
 * Verify Neon connectivity and list columns for `research_results`.
 * Usage from repo root (loads `.env.local` if you `export $(grep -v '^#' .env.local | xargs)` or pass DATABASE_URL):
 *   `npx tsx scripts/list-research-results-columns.ts`
 */
import { getDbPool, shutdownDbPool } from '../lib/db'

async function main() {
  const pool = getDbPool()
  const r = await pool.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'research_results'
     ORDER BY ordinal_position`
  )
  if (r.rows.length === 0) {
    console.error('No columns found — table may be missing or not in public schema.')
    process.exit(1)
  }
  console.log('research_results columns:')
  for (const row of r.rows) {
    console.log(`  - ${row.column_name} (${row.data_type})`)
  }
  await shutdownDbPool()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
