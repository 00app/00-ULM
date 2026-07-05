/**
 * Tavily monthly credit guardrail — free tier is 1,000 credits/month. Tavily is a *backup*
 * scraper (only called when Firecrawl misses a URL), so this exists to make sure a busy day
 * can't silently blow through the free allowance and start billing. Counter is DB-backed
 * (not in-memory) so it holds across serverless cold starts / concurrent invocations.
 */
import { getDbPool } from '@/lib/db'

/** Basic extract costs 1 credit per 5 URLs (rounded up) — keep ~10% headroom under the hard cap. */
const DEFAULT_MONTHLY_CAP = 900

function resolveMonthlyCap(): number {
  const raw = process.env.TAVILY_MONTHLY_CAP?.trim()
  const n = raw ? parseInt(raw, 10) : DEFAULT_MONTHLY_CAP
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MONTHLY_CAP
  return Math.min(1000, n)
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

async function ensureTable(): Promise<void> {
  const pool = getDbPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tavily_usage_monthly (
      month_key TEXT PRIMARY KEY,
      credits_used INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

/**
 * Atomically reserve `credits` against this month's budget. Returns true (and commits the
 * reservation) only if the cap isn't breached — callers must skip the Tavily call on false.
 * Never throws on infra failure: if the DB write itself fails, we fail closed (deny the call)
 * rather than risk uncounted spend.
 */
export async function reserveTavilyCredits(credits: number): Promise<boolean> {
  if (credits <= 0) return true
  const cap = resolveMonthlyCap()
  const month = currentMonthKey()
  try {
    await ensureTable()
    const pool = getDbPool()
    await pool.query(
      `INSERT INTO tavily_usage_monthly (month_key, credits_used) VALUES ($1, 0)
       ON CONFLICT (month_key) DO NOTHING`,
      [month]
    )
    const res = await pool.query<{ credits_used: number }>(
      `UPDATE tavily_usage_monthly
       SET credits_used = credits_used + $2, updated_at = NOW()
       WHERE month_key = $1 AND credits_used + $2 <= $3
       RETURNING credits_used`,
      [month, credits, cap]
    )
    if (res.rows.length === 0) {
      console.warn(`[tavilyBudget] denied ${credits} credit(s) — month=${month} cap=${cap}`)
      return false
    }
    return true
  } catch (e) {
    console.warn('[tavilyBudget] reservation failed, denying call:', e)
    return false
  }
}

/** Read-only — for diagnostics/Flight Deck, never gates a call. */
export async function readTavilyUsageThisMonth(): Promise<{ month: string; used: number; cap: number }> {
  const month = currentMonthKey()
  const cap = resolveMonthlyCap()
  try {
    await ensureTable()
    const pool = getDbPool()
    const res = await pool.query<{ credits_used: number }>(
      `SELECT credits_used FROM tavily_usage_monthly WHERE month_key = $1`,
      [month]
    )
    return { month, used: res.rows[0]?.credits_used ?? 0, cap }
  } catch {
    return { month, used: 0, cap }
  }
}
