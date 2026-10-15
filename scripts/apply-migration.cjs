/**
 * Apply one SQL migration file to a Neon DB in a single transaction (rolls back on error).
 * Run: DBURL='postgresql://…' node scripts/apply-migration.cjs db/migrations/<file>.sql
 */
const fs = require('fs')
const { Pool } = require('pg')

const url = (process.env.DBURL || '').trim().replace(/[?&]channel_binding=[^&]*/, '')
const file = process.argv[2]
if (!url || url.includes('PASTE') || !file) {
  console.error('❌ Usage: DBURL=<connection string> node scripts/apply-migration.cjs <migration.sql>')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, max: 1 })

;(async () => {
  const c = await pool.connect()
  try {
    console.log('Target host:', new URL(url).hostname)
    await c.query('BEGIN')
    await c.query(fs.readFileSync(file, 'utf8'))
    await c.query('COMMIT')
    console.log(`✅ Applied ${file}`)
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    console.error('❌ Failed (rolled back):', e instanceof Error ? e.message : e)
    process.exitCode = 1
  } finally {
    c.release()
    await pool.end()
  }
})().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
