/**
 * Apply idempotent Neon migrations not covered by init-db / evolve-12-domains.
 * Run: npm run db:apply-pending
 */
import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'
import { withNeonPool } from './neon-wake'

const MIGRATION_FILES = [
  '20260519_ulm_genome_expansion.sql',
  '20260522_guest_visits_and_research_hygiene.sql',
  '20260521_drop_legacy_unused_tables.sql',
  '20260526_drop_orphan_legacy_tables.sql',
] as const

async function main() {
  loadEnvLocal({ preferLocal: true })
  // Use Neon serverless pool (default) — do not force node-pg TCP (flakes on cold start).

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  await withNeonPool(async (query) => {
    for (const file of MIGRATION_FILES) {
      const migPath = path.join(process.cwd(), 'db', 'migrations', file)
      if (!fs.existsSync(migPath)) {
        console.warn(`⚠️  Skip missing ${file}`)
        continue
      }
      const sql = fs.readFileSync(migPath, 'utf8')
      try {
        await query(sql)
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

    const guestCols = (await query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'guest_sessions'
       ORDER BY ordinal_position`
    )) as { rows: { column_name: string }[] }
    console.log(
      '   guest_sessions:',
      guestCols.rows.map((r) => r.column_name).join(', ')
    )
    console.log('✅ Pending migrations complete.')
  })
}

main().catch((e: unknown) => {
  console.error('❌', e instanceof Error ? e.message : e)
  console.error(
    '   Tip: run `npm run db:test` once (wakes Neon), then retry `npm run db:apply-pending`.'
  )
  process.exit(1)
})
