/**
 * Link BN17 research_results rows to the Gary demo UUID and ensure users.postcode is set.
 * Usage: DATABASE_URL='postgresql://...' npx tsx scripts/link-gary-bn17-research.ts
 *
 * Never commit credentials — read only from DATABASE_URL in the environment.
 */
import { Client } from 'pg'

const GARY_USER_ID = '00000000-0000-4000-a000-000000000000'

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const c = new Client({ connectionString })
  await c.connect()

  await c.query(
    `INSERT INTO users (id, name, postcode, user_genome)
     VALUES ($1::uuid, 'Gary Demo', 'BN17', '{}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       postcode = EXCLUDED.postcode,
       name = COALESCE(users.name, EXCLUDED.name)`,
    [GARY_USER_ID]
  )

  const linked = await c.query(
    `UPDATE research_results
     SET user_id = $1::uuid
     WHERE user_id IS DISTINCT FROM $1::uuid
       AND (
         REPLACE(COALESCE(postcode, ''), ' ', '') LIKE 'BN17%'
         OR COALESCE(locality_context, '') ILIKE '%BN17%'
       )`,
    [GARY_USER_ID]
  )

  const mirror = await c.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_profiles'`
  )
  const cols = new Set(mirror.rows.map((r) => r.column_name))
  if (cols.has('user_id') && cols.has('journey_answers_jsonb')) {
    await c.query(
      `INSERT INTO user_profiles (user_id, journey_answers_jsonb, updated_at)
       VALUES ($1::uuid, '{}'::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [GARY_USER_ID]
    )
  }

  console.log(`✅ Linked ${linked.rowCount ?? 0} research_results row(s) to Gary UUID`)
  console.log(`✅ users.postcode set to BN17 for ${GARY_USER_ID}`)
  await c.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
