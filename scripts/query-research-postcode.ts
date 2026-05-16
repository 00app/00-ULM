/**
 * List research_results for a postcode (space-normalized).
 * Usage: npx tsx scripts/query-research-postcode.ts BN17
 */
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '../lib/db'

async function main() {
  loadEnvLocal({ preferLocal: true })
  const pc = (process.argv[2] ?? 'BN17').replace(/\s+/g, '').toUpperCase()
  const url = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!url) {
    console.error('DATABASE_URL missing — set in .env.local or pass via env')
    process.exit(1)
  }

  const sql = neon(url)
  const rows = await sql`
    SELECT id::text AS id,
           category,
           agent_headline,
           postcode,
           saving_amount_gbp,
           length(markdown) AS markdown_chars,
           created_at
    FROM research_results
    WHERE REPLACE(COALESCE(postcode, ''), ' ', '') = ${pc}
    ORDER BY created_at DESC NULLS LAST
    LIMIT 25
  `
  console.log(`--- research_results for ${pc} (${rows.length} rows) ---`)
  console.table(rows)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
