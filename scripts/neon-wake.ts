/**
 * Wake suspended Neon compute before TCP/pg CLI scripts (pooler cold start).
 * Uses HTTP driver first (same as db:test), then optional pool ping.
 */
import type { QueryResult } from 'pg'
import { wakeNeonHttp } from '../lib/db'

export { wakeNeonHttp }

const WAKE_ATTEMPTS = 4
const WAKE_DELAY_MS = 2_500

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
