/**
 * Apply idempotent Neon migrations not covered by init-db / evolve-12-domains.
 * Run: npm run db:apply-pending
 */
import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'

const MIGRATION_FILES = [
  '20260519_ulm_genome_expansion.sql',
  '20260522_guest_visits_and_research_hygiene.sql',
  '20260521_drop_legacy_unused_tables.sql',
  '20260526_drop_orphan_legacy_tables.sql',
] as const

async function main() {
  loadEnvLocal({ preferLocal: true })
  process.env.DATABASE_USE_NEON_SERVERLESS = '0'

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  const { default: pool, shutdownDbPool } = await import('../lib/db')

  try {
    for (const file of MIGRATION_FILES) {
      const migPath = path.join(process.cwd(), 'db', 'migrations', file)
      if (!fs.existsSync(migPath)) {
        console.warn(`⚠️  Skip missing ${file}`)
        continue
      }
      const sql = fs.readFileSync(migPath, 'utf8')
      try {
        await pool.query(sql)
        console.log(`✅ Applied db/migrations/${file}`)
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err)
        if (
          m.includes('already exists') ||
          m.includes('duplicate') ||
          m.includes('does not exist')
        ) {
          console.log(`✓  db/migrations/${file} (already applied)`)
          continue
        }
        throw err
      }
    }

    const guestCols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'guest_sessions'
       ORDER BY ordinal_position`
    )
    console.log(
      '   guest_sessions:',
      guestCols.rows.map((r) => r.column_name).join(', ')
    )
    console.log('✅ Pending migrations complete.')
  } finally {
    await shutdownDbPool()
  }
}

main().catch((e: unknown) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
