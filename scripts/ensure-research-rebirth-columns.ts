/**
 * Idempotent: ensure rebirth columns exist on `research_results` (Neon).
 *   npm run db:ensure-rebirth-columns
 */
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '../lib/db'

async function main() {
  loadEnvLocal({ preferLocal: true })
  const url = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!url) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }
  const sql = neon(url)
  await sql`ALTER TABLE research_results ADD COLUMN IF NOT EXISTS is_high_impact BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE research_results ADD COLUMN IF NOT EXISTS carbon_impact_kg NUMERIC(12, 2)`
  const rows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_results'
      AND column_name IN ('is_high_impact', 'carbon_impact_kg')
    ORDER BY column_name
  `
  console.log('✅ rebirth columns:', rows)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
