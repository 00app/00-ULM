/**
 * Verify discovery_injections + journey_answers_jsonb exist for Zai pinned suggestions.
 * Run: npm run db:verify-discovery
 */
import { loadEnvLocal } from './load-env-local'
import pool from '../lib/db'

loadEnvLocal({ preferLocal: true })

const REQUIRED_TABLES = ['discovery_injections', 'journey_answers_jsonb', 'journey_answers', 'likes'] as const

async function main() {
  for (const table of REQUIRED_TABLES) {
    const res = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`]
    )
    const ok = Boolean(res.rows[0]?.reg)
    console.log(`${ok ? '✓' : '✗'} ${table}${ok ? '' : ' — MISSING'}`)
    if (!ok) process.exitCode = 1
  }

  const cols = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'discovery_injections'
     ORDER BY column_name`
  )
  const names = new Set(cols.rows.map((r) => r.column_name))
  for (const col of ['user_id', 'card_id', 'payload', 'source', 'journey_key']) {
    const ok = names.has(col)
    console.log(`${ok ? '✓' : '✗'} discovery_injections.${col}`)
    if (!ok) process.exitCode = 1
  }

  console.log('\nSuggestions capability:', process.exitCode === 1 ? 'INCOMPLETE' : 'OK')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
