/**
 * Print the latest row from research_results (verification / Neon smoke).
 * Uses DATABASE_URL from .env.local via scripts/load-env-local.ts
 */
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'

async function main() {
  loadEnvLocal()
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  const sql = neon(url)
  try {
    const rows = await sql`
      SELECT id, user_id, postcode, category, offer_url,
             verified_saving, saving_amount_gbp,
             agent_headline, architect_prose, created_at
      FROM research_results
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) {
      console.log('No rows in research_results yet.')
      process.exit(0)
      return
    }
    console.log('Latest research_results row:')
    console.log(JSON.stringify(row, null, 2))
    process.exit(0)
  } catch (e) {
    console.error('db:log-research failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
