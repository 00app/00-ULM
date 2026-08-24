/**
 * Neon-backed fixed-window rate limit — durable across serverless cold starts and shared by
 * every instance, without adding a new vendor (Upstash/Redis). Same fixed-window semantics as
 * the Upstash path in `rateLimitDistributed.ts` (increment first, decide after) so callers get
 * identical behavior regardless of which backend answered. Falls back to null (caller uses
 * in-memory) if the DB write itself fails — never blocks a request on a rate-limit outage.
 */
import { getDbPool, isDatabaseConfigured } from '@/lib/db'

const WINDOW_SEC = 60

type DistributedResult = { ok: boolean; retryAfter?: number }

let tableEnsured = false

async function ensureTable(): Promise<void> {
  if (tableEnsured) return
  const pool = getDbPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits_window (
      rl_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  tableEnsured = true
}

/** Best-effort, non-blocking prune of long-stale rows so the table doesn't grow forever.
 *  Cheap to skip most of the time — no cron needed. */
function maybePruneStaleRows(pool: ReturnType<typeof getDbPool>): void {
  if (Math.random() > 0.01) return
  pool
    .query(`DELETE FROM rate_limits_window WHERE window_start < NOW() - INTERVAL '1 day'`)
    .catch(() => {
      /* best-effort */
    })
}

/** Returns null when the DB isn't configured or the write fails — caller falls back to in-memory. */
export async function checkRateLimitNeon(
  key: string,
  maxPerWindow: number,
  windowSec: number = WINDOW_SEC
): Promise<DistributedResult | null> {
  if (!isDatabaseConfigured()) return null
  // Integer, never user input — this function's own callers pass a literal, so string
  // interpolation into the INTERVAL literal below is safe (no parameter placeholder for INTERVAL).
  const safeWindowSec = Math.max(1, Math.floor(windowSec))

  try {
    await ensureTable()
    const pool = getDbPool()
    maybePruneStaleRows(pool)

    const res = await pool.query<{ count: number; window_start: string }>(
      `INSERT INTO rate_limits_window (rl_key, count, window_start)
       VALUES ($1, 1, NOW())
       ON CONFLICT (rl_key) DO UPDATE SET
         count = CASE
           WHEN rate_limits_window.window_start > NOW() - INTERVAL '${safeWindowSec} seconds'
           THEN rate_limits_window.count + 1
           ELSE 1
         END,
         window_start = CASE
           WHEN rate_limits_window.window_start > NOW() - INTERVAL '${safeWindowSec} seconds'
           THEN rate_limits_window.window_start
           ELSE NOW()
         END
       RETURNING count, window_start`,
      [key]
    )

    const row = res.rows[0]
    if (!row) return null

    const count = Number(row.count)
    const windowStartMs = new Date(row.window_start).getTime()
    const elapsedSec = Math.max(0, (Date.now() - windowStartMs) / 1000)
    const retryAfter = Math.max(1, Math.ceil(safeWindowSec - elapsedSec))

    if (count > maxPerWindow) {
      return { ok: false, retryAfter }
    }
    return { ok: true }
  } catch (e) {
    console.warn('[rateLimitNeon] check failed, falling back:', e)
    return null
  }
}
