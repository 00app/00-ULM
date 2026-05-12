/**
 * Smoke-test Neon: connectivity + public table list (uses Neon HTTP driver — works without TCP/pg WebSockets).
 */
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'

async function main() {
  loadEnvLocal()
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('❌ DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  const sql = neon(url)

  try {
    const ping = await sql`SELECT 1 AS ok`
    console.log('✅ Neon ping:', ping)

    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const names = (tables as { tablename: string }[]).map((r) => r.tablename)
    console.log(`✅ Public tables (${names.length}): ${names.join(', ') || '(none — run npm run init-db)'}`)

    try {
      const rr = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'research_results'
        ORDER BY ordinal_position
      `
      const cols = rr as { column_name: string; data_type: string }[]
      if (cols.length > 0) {
        console.log(
          '✅ research_results columns:',
          cols.map((c) => `${c.column_name}:${c.data_type}`).join(', ')
        )
      }
    } catch {
      /* optional */
    }

    process.exit(0)
  } catch (e) {
    console.error('❌ db-test failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
