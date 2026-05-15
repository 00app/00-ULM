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

/**
 * Neon “Connection details” sometimes append `channel_binding=require` (SCRAM).
 * That breaks or flakes some Node `pg` / pooler paths; pooler + sslmode=require is enough.
 */
export function sanitizeNeonConnectionString(connectionString: string): string {
  const t = connectionString.trim()
  if (!t.includes('channel_binding')) return t
  try {
    const u = new URL(t)
    u.searchParams.delete('channel_binding')
    let out = u.toString()
    if (out.endsWith('?')) out = out.slice(0, -1)
    return out
  } catch {
    return t
      .replace(/[?&]channel_binding=[^&]*/gi, '')
      .replace(/\?&+/g, '?')
      .replace(/&&+/g, '&')
      .replace(/\?$/g, '')
  }
}

/**
 * Force `sslmode=require` on the connection URI query string only.
 * Avoids `new URL()` on full postgres URIs — WHATWG parsing can corrupt passwords
 * that contain reserved characters (e.g. `@`, `#`) if not perfectly percent-encoded.
 */
export function mergeSslModeRequire(connectionString: string): string {
  const t = connectionString.trim()
  if (!t) return t
  if (/\bsslmode=[^&]*/i.test(t)) {
    return t.replace(/\bsslmode=[^&]*/gi, 'sslmode=require')
  }
  const joiner = t.includes('?') ? '&' : '?'
  return `${t}${joiner}sslmode=require`
}

function resolveConnectionString(): string {
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  const connectionString = raw ? sanitizeNeonConnectionString(raw) : ''
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
  return mergeSslModeRequire(resolved)
}

/** Prefer Neon serverless Pool (HTTP-backed) over node-pg TCP pool for Neon hosts. */
function shouldUseNeonServerless(connectionString: string): boolean {
  if (process.env.DATABASE_USE_NEON_SERVERLESS === '0') return false
  if (process.env.DATABASE_USE_NEON_SERVERLESS === '1') return true
  const u = connectionString.toLowerCase()
  return u.includes('neon.tech') || u.includes('.neon.build')
}

function poolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 32)
  }
  return 10
}

function createPool(resolved: string): DbPool {
  const max = poolMax()
  const isProd = process.env.NODE_ENV === 'production'

  if (shouldUseNeonServerless(resolved)) {
    const pool = new NeonPool({
      connectionString: resolved,
      max,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
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
  store.pool = createPool(resolved)
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
