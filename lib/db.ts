import { neon, Pool as NeonPool } from '@neondatabase/serverless'
import { Pool as PgPool } from 'pg'

export type DbPool = NeonPool | PgPool

type SqlFn = ReturnType<typeof neon>

type DbGlobal = {
  pool: DbPool | null
  sql: SqlFn | null
  wakePromise: Promise<void> | null
}

function dbGlobal(): DbGlobal {
  const g = globalThis as unknown as { __zz_neon_db?: DbGlobal }
  if (!g.__zz_neon_db) {
    g.__zz_neon_db = { pool: null, sql: null, wakePromise: null }
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

function maskDatabasePassword(connectionString: string): string | null {
  if (!connectionString) return null
  return connectionString.replace(/:\/\/([^:/?#]+):[^@]+@/, '://$1:***@')
}

function parseDatabaseUrl(connectionString: string) {
  if (!connectionString) {
    return { host: null, database: null, user: null, sslmode: null }
  }

  try {
    const url = new URL(connectionString)
    return {
      host: url.host || null,
      database: url.pathname?.slice(1) || null,
      user: url.username || null,
      sslmode: url.searchParams.get('sslmode') || null,
    }
  } catch {
    const match = connectionString.match(
      /^postgres(?:ql)?:\/\/([^:/?#]+):([^@]+)@([^/]+)\/([^?]+)(?:\?(.*))?$/i
    )
    if (!match) {
      return { host: null, database: null, user: null, sslmode: null }
    }
    const [, user, , host, database, query] = match
    const sslmode = query?.split('&').find((part) => part.startsWith('sslmode='))?.split('=')[1] ?? null
    return { host, database, user, sslmode }
  }
}

export type DatabaseConnectionInfo = {
  configured: boolean
  hasDatabaseUrl: boolean
  host: string | null
  database: string | null
  user: string | null
  sslmode: string | null
  isNeonServerless: boolean
  maskedConnectionString: string | null
}

export function getDatabaseConnectionInfo(): DatabaseConnectionInfo {
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  const resolved = raw ? mergeSslModeRequire(sanitizeNeonConnectionString(raw)) : ''
  const parsed = parseDatabaseUrl(resolved)

  return {
    configured: isDatabaseConfigured(),
    hasDatabaseUrl: Boolean(raw),
    host: parsed.host,
    database: parsed.database,
    user: parsed.user,
    sslmode: parsed.sslmode,
    isNeonServerless: shouldUseNeonServerless(resolved),
    maskedConnectionString: maskDatabasePassword(resolved),
  }
}

/** True when a real Neon/Vercel DATABASE_URL is configured (not dev localhost fallback). */
export function isDatabaseConfigured(): boolean {
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  if (!raw) return false
  if (/localhost\/neondb/i.test(raw) || raw === 'postgresql://localhost/neondb?sslmode=require') {
    return false
  }
  return true
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

const WAKE_ATTEMPTS = 4
const WAKE_DELAY_MS = 2_500

function isRetryableDbError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return (
    m.includes('timeout') ||
    m.includes('terminated') ||
    m.includes('ECONNRESET') ||
    m.includes('Connection terminated') ||
    m.includes('compute is suspended') ||
    m.includes("Can't reach database server")
  )
}

/** HTTP wake for suspended Neon compute — safe for serverless cold starts. */
export async function wakeNeonHttp(databaseUrl?: string): Promise<void> {
  const raw = databaseUrl?.trim() || process.env.DATABASE_URL?.trim() || ''
  const url = mergeSslModeRequire(sanitizeNeonConnectionString(raw))
  if (!url || !shouldUseNeonServerless(url)) return

  const sql = neon(url)
  let lastErr: unknown
  for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
    try {
      await sql`SELECT 1 AS ok`
      return
    } catch (err) {
      lastErr = err
      if (attempt < WAKE_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function neonWakeOnce(resolved: string): Promise<void> {
  const store = dbGlobal()
  if (!store.wakePromise) {
    store.wakePromise = shouldUseNeonServerless(resolved)
      ? wakeNeonHttp(resolved).catch((err) => {
          console.warn('[db] neon wake failed:', err)
        })
      : Promise.resolve()
  }
  return store.wakePromise
}

/** Every pool.query awaits HTTP wake once per serverless runtime (suspended compute). */
function wrapPoolWithNeonWake(pool: DbPool, resolved: string): DbPool {
  if (!shouldUseNeonServerless(resolved)) return pool
  return new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === 'query') {
        const orig = target.query.bind(target)
        return (...args: unknown[]) =>
          neonWakeOnce(resolved).then(() =>
            (orig as (...a: unknown[]) => unknown).apply(target, args)
          )
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
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
  store.pool = wrapPoolWithNeonWake(createPool(resolved), resolved)
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
/** Health / diagnostics — wake + retry for suspended Neon compute. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
  const resolved = resolveConnectionString()
  const t0 = Date.now()
  let lastErr: unknown

  for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt++) {
    try {
      if (shouldUseNeonServerless(resolved)) {
        await wakeNeonHttp(resolved)
      }
      await ensurePool().query('SELECT 1')
      return { ok: true, latencyMs: Math.max(0, Date.now() - t0) }
    } catch (err) {
      lastErr = err
      if (!isRetryableDbError(err) || attempt >= WAKE_ATTEMPTS) break
      await new Promise((r) => setTimeout(r, WAKE_DELAY_MS))
    }
  }

  if (shouldUseNeonServerless(resolved)) {
    try {
      await ensureSql()`SELECT 1`
      return { ok: true, latencyMs: Math.max(0, Date.now() - t0) }
    } catch {
      console.warn('[db] ping failed (pool + neon):', lastErr)
    }
  }
  return { ok: false, latencyMs: null }
}

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
  store.wakePromise = null
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
