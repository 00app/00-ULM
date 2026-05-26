/**
 * Wake suspended Neon compute before TCP/pg CLI scripts (pooler cold start).
 * Uses HTTP driver first (same as db:test), then optional pool ping.
 */
import { neon } from '@neondatabase/serverless'
import type { QueryResult } from 'pg'
import { sanitizeNeonConnectionString } from '../lib/db'

const WAKE_ATTEMPTS = 4
const WAKE_DELAY_MS = 2_500

export async function wakeNeonHttp(databaseUrl?: string): Promise<void> {
  const raw = databaseUrl?.trim() || process.env.DATABASE_URL?.trim() || ''
  const url = sanitizeNeonConnectionString(raw)
  if (!url) {
    throw new Error('DATABASE_URL missing — set in .env.local')
  }

  const sql = neon(url)
  let lastErr: unknown
  for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
    try {
      await sql`SELECT 1 AS ok`
      if (attempt > 1) {
        console.log(`✅ Neon awake (attempt ${attempt}/${WAKE_ATTEMPTS})`)
      }
      return
    } catch (err) {
      lastErr = err
      if (attempt < WAKE_ATTEMPTS) {
        console.warn(
          `⚠️  Neon wake attempt ${attempt}/${WAKE_ATTEMPTS} failed — retrying in ${WAKE_DELAY_MS / 1000}s…`
        )
        await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function isRetryableDbError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return (
    m.includes('timeout') ||
    m.includes('terminated') ||
    m.includes('ECONNRESET') ||
    m.includes('Connection terminated')
  )
}

/** Run pool.query with HTTP wake + retries (for migration scripts). */
export async function withNeonPool<T>(
  fn: (query: (text: string) => Promise<QueryResult>) => Promise<T>
): Promise<T> {
  await wakeNeonHttp()
  const { getDbPool, shutdownDbPool } = await import('../lib/db')
  const pool = getDbPool()
  let lastErr: unknown

  try {
    for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
      try {
        return await fn((text) => pool.query(text))
      } catch (err) {
        lastErr = err
        if (!isRetryableDbError(err) || attempt >= WAKE_ATTEMPTS) break
        console.warn(`⚠️  Pool query attempt ${attempt}/${WAKE_ATTEMPTS} failed — retrying…`)
        await wakeNeonHttp()
        await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  } finally {
    await shutdownDbPool().catch(() => {})
  }
}
