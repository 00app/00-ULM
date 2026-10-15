/**
 * Additive, idempotent schema alignment for a Neon DB that predates two migrations:
 *   - zai_messages (db/migrations/20260704_recreate_zai_messages.sql)
 *   - user_profiles.journey_answers_jsonb (Solo Focus mirror column)
 * Runs in one transaction; drops nothing.
 * Run: DBURL='postgresql://…' node scripts/align-prod-schema.cjs
 */
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const url = (process.env.DBURL || '').trim().replace(/[?&]channel_binding=[^&]*/, '')
if (!url) {
  console.error('❌ DBURL missing — pass the target connection string as DBURL')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, max: 1 })

;(async () => {
  const c = await pool.connect()
  try {
    console.log('Target host:', new URL(url).hostname)
    await c.query('BEGIN')
    await c.query(
      fs.readFileSync(
        path.join(__dirname, '..', 'db', 'migrations', '20260704_recreate_zai_messages.sql'),
        'utf8'
      )
    )
    await c.query(
      `ALTER TABLE user_profiles
       ADD COLUMN IF NOT EXISTS journey_answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb`
    )
    await c.query('COMMIT')
    const v = await c.query(
      `SELECT to_regclass('public.zai_messages')::text AS zai_messages,
              (SELECT COUNT(*)::int FROM pg_indexes WHERE tablename = 'zai_messages') AS zai_indexes,
              (SELECT COUNT(*)::int FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'user_profiles'
                 AND column_name = 'journey_answers_jsonb') AS user_profiles_column`
    )
    console.log('✅ Applied:', JSON.stringify(v.rows[0]))
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    console.error('❌ Failed (rolled back):', e instanceof Error ? e.message : e)
    process.exitCode = 1
  } finally {
    c.release()
    await pool.end()
  }
})()
