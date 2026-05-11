import { neon, Pool as NeonPool } from '@neondatabase/serverless'
import { Pool as PgPool } from 'pg'

export type DbPool = NeonPool | PgPool

type SqlFn = ReturnType<typeof neon>

type DbGlobal = {
  pool: DbPool | null
  sql: SqlFn | null
}

function dbGlobal(): DbGlobal {
  const g = globalThis as unknown as { __zz_neon_db?: DbGlobal }
  if (!g.__zz_neon_db) {
    g.__zz_neon_db = { pool: null, sql: null }
  }
  return g.__zz_neon_db
}

function resolveConnectionString(): string {
  const connectionString = process.env.DATABASE_URL?.trim()
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && !connectionString) {
    throw new Error('DATABASE_URL is required in production. Set it in your environment (e.g. Vercel).')
  }

  const resolved =
    connectionString ||
    (process.env.NODE_ENV !== 'production' ? 'postgresql://localhost/neondb?sslmode=require' : '')
  if (!resolved) {
    throw new Error('DATABASE_URL is required in production.')
  }
  return resolved
}

/** Prefer Neon serverless Pool (HTTP-backed) over node-pg TCP pool for Neon hosts. */
function shouldUseNeonServerless(connectionString: string): boolean {
  if (process.env.DATABASE_USE_NEON_SERVERLESS === '0') return false
  if (process.env.DATABASE_USE_NEON_SERVERLESS === '1') return true
  const u = connectionString.toLowerCase()
  return u.includes('neon.tech') || u.includes('.neon.build')
}

function poolMax(useNeonServerless: boolean): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 32)
  }
  if (process.env.NODE_ENV === 'production' && useNeonServerless) {
    return 1
  }
  if (process.env.NODE_ENV === 'production') {
    return 5
  }
  return 10
}

function createPool(resolved: string, useNeonServerless: boolean): DbPool {
  const max = poolMax(useNeonServerless)
  const isProd = process.env.NODE_ENV === 'production'

  if (useNeonServerless) {
    const pool = new NeonPool({
      connectionString: resolved,
      max,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: isProd ? 10_000 : 30_000,
      allowExitOnIdle: isProd,
    })
    pool.on('error', (err: unknown) => {
      console.error('[db] Unexpected error on Neon pool', err)
    })
    return pool
  }

  const pool = new PgPool({
    connectionString: resolved,
    max,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  })
  pool.on('error', (err: unknown) => {
    console.error('[db] Unexpected error on idle pg client', err)
  })
  return pool
}

function ensurePool(): DbPool {
  const store = dbGlobal()
  if (store.pool) return store.pool

  const resolved = resolveConnectionString()
  const useNeon = shouldUseNeonServerless(resolved)
  store.pool = createPool(resolved, useNeon)
  return store.pool
}

/**
 * Shared DB pool — one instance per runtime (globalThis) so Next.js dev HMR
 * does not spawn duplicate pools, and production reuses a single Neon serverless pool.
 */
export function getDbPool(): DbPool {
  return ensurePool()
}

/**
 * Gracefully close the pool and clear singletons. Use after long batch jobs
 * (e.g. cron) so the invocation does not hold idle backends. Safe to call when
 * idle; the next `getDbPool()` creates a fresh pool.
 */
export async function shutdownDbPool(): Promise<void> {
  const store = dbGlobal()
  if (store.pool) {
    try {
      await store.pool.end()
    } catch (e) {
      console.warn('[db] pool.end() failed:', e)
    }
    store.pool = null
  }
  store.sql = null
}

/** Lazy default export so `next build` can import routes without DATABASE_URL at module init. */
const pool = new Proxy({} as DbPool, {
  get(_, prop) {
    const real = ensurePool()
    const value = (real as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

export default pool

function ensureSql(): SqlFn {
  const store = dbGlobal()
  if (store.sql) return store.sql
  const resolved = resolveConnectionString()
  store.sql = neon(resolved)
  return store.sql
}

export async function getUserGenome(userId: string) {
  const sql = ensureSql()
  const rows = (await sql`SELECT genome FROM users WHERE id = ${userId}`) as { genome?: unknown }[]
  return rows[0]?.genome ?? {}
}

export async function updateGoal(userId: string, newGoal: 'SAVE' | 'REDUCE') {
  const sql = ensureSql()
  await sql`UPDATE users SET goal = ${newGoal} WHERE id = ${userId}`
}

export async function saveUserAnswer(userId: string, answerData: any) {
  const sql = ensureSql()
  await sql`
    UPDATE users 
    SET genome = genome || ${JSON.stringify(answerData)}::jsonb
    WHERE id = ${userId}
  `
}
