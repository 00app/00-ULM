import pool from '../lib/db'
import fs from 'fs'
import path from 'path'

async function initDatabase() {
  const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql')
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ lib/schema.sql not found. Run from project root.')
    process.exit(1)
  }
  try {
    console.log('Initializing database schema (Neon)...')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    const statements = schema
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (!statement) continue
      try {
        await pool.query(statement + ';')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (
          msg.includes('already exists') ||
          msg.includes('duplicate') ||
          msg.includes('does not exist')
        ) {
          // Expected when re-running or altering
          continue
        }
        console.warn(`Warning: ${msg.slice(0, 120)}`)
      }
    }

    console.log('✅ Database schema initialized. Tables: users, sessions, journey_answers, journey_answers_jsonb, guest_sessions, research_results, likes, etc.')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    try {
      await pool.end()
    } catch {
      //
    }
    process.exit(1)
  }
}

initDatabase()
