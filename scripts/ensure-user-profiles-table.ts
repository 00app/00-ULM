/**
 * Ensures `public.user_profiles` exists (Solo Focus / Hermes mirror).
 *   npm run db:ensure-user-profiles
 */
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '@/lib/db'

async function main() {
  loadEnvLocal({ preferLocal: true })
  const url = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!url) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }
  const sql = neon(url)
  await sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
      journey_answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles (updated_at DESC)
  `
  const rows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
    ORDER BY ordinal_position
  `
  console.log('✅ user_profiles columns:', rows)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
