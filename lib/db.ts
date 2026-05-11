import { Pool as PgPool } from 'pg'
import { neon, Pool as NeonPool } from '@neondatabase/serverless'

type DbPool = NeonPool | PgPool

let poolSingleton: DbPool | null = null
let sqlSingleton: ReturnType<typeof neon> | null = null

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

function ensurePool(): DbPool {
  if (poolSingleton) return poolSingleton

  const resolved = resolveConnectionString()
  const useNeonServerless = resolved.includes('neon.tech')

  poolSingleton = useNeonServerless
    ? new NeonPool({ connectionString: resolved })
    : new PgPool({
        connectionString: resolved,
        ssl: undefined,
      })

  poolSingleton.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  return poolSingleton
}

export function getDbPool(): DbPool {
  return ensurePool()
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

function ensureSql() {
  if (sqlSingleton) return sqlSingleton
  const resolved = resolveConnectionString()
  sqlSingleton = neon(resolved)
  return sqlSingleton
}

export async function getUserGenome(userId: string) {
  const sql = ensureSql()
  const rows = (await sql`SELECT genome FROM users WHERE id = ${userId}`) as { genome?: unknown }[]
  return rows[0]?.genome ?? {}
}

export async function updateGoal(userId: string, newGoal: 'SAVE' | 'REDUCE') {
  const sql = ensureSql()
  await sql`UPDATE users SET goal = ${newGoal} WHERE id = ${userId}`;
}

export async function saveUserAnswer(userId: string, answerData: any) {
  const sql = ensureSql()
  await sql`
    UPDATE users 
    SET genome = genome || ${JSON.stringify(answerData)}::jsonb
    WHERE id = ${userId}
  `;
}
