import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'

function splitSqlStatements(sql: string): string[] {
  const out: string[] = []
  let cur = ''
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]!
    const next = sql[i + 1]
    if (c === "'" && !inDouble) {
      if (inSingle && next === "'") {
        cur += "''"
        i++
        continue
      }
      inSingle = !inSingle
      cur += c
      continue
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble
      cur += c
      continue
    }
    if (c === ';' && !inSingle && !inDouble) {
      const stmt = cur.trim()
      if (stmt.length > 0 && !stmt.startsWith('--')) out.push(stmt)
      cur = ''
      continue
    }
    cur += c
  }
  const tail = cur.trim()
  if (tail.length > 0 && !tail.startsWith('--')) out.push(tail)
  return out
}

async function initDatabase() {
  loadEnvLocal({ preferLocal: true })
  /** Neon serverless driver uses WebSockets; `pg` TCP works reliably for one-off CLI applies. */
  process.env.DATABASE_USE_NEON_SERVERLESS = '0'

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('❌ DATABASE_URL is not set. Add it to .env.local or the environment.')
    process.exit(1)
  }

  const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql')
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ lib/schema.sql not found. Run from project root.')
    process.exit(1)
  }

  const { default: pool, shutdownDbPool } = await import('../lib/db')

  try {
    console.log('Initializing database schema (Neon)…')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    try {
      await pool.query(schema)
      console.log('✅ Applied lib/schema.sql (single batch).')
    } catch (batchErr: unknown) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr)
      if (msg.includes('password authentication failed') || msg.includes('28P01')) {
        console.error(
          '❌ Neon rejected DATABASE_URL (wrong password or rotated credentials).\n   In Neon → Connection details → copy a fresh URI into .env.local and retry.'
        )
        throw batchErr
      }
      console.warn('⚠️  Single-batch apply failed, running statements one-by-one:', msg.slice(0, 160))
      const statements = splitSqlStatements(schema)
      let ok = 0
      for (const statement of statements) {
        if (!statement.trim()) continue
        try {
          await pool.query(statement + (statement.endsWith(';') ? '' : ';'))
          ok++
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err)
          if (m.includes('password authentication failed') || m.includes('28P01')) {
            console.error(
              '❌ Neon rejected DATABASE_URL (wrong password or rotated credentials).\n   In Neon → Connection details → copy a fresh URI into .env.local and retry.'
            )
            throw err
          }
          if (
            m.includes('already exists') ||
            m.includes('duplicate') ||
            m.includes('does not exist')
          ) {
            continue
          }
          console.warn(`Statement warning: ${m.slice(0, 200)}`)
        }
      }
      console.log(`✅ Executed ${ok} statement(s) individually.`)
    }

    const verify = await pool.query<{ n: string }>(
      `SELECT tablename AS n FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const tables = verify.rows.map((r) => r.n)
    console.log(`✅ Public tables (${tables.length}): ${tables.join(', ')}`)

    await shutdownDbPool()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    try {
      await shutdownDbPool()
    } catch {
      //
    }
    process.exit(1)
  }
}

initDatabase()
