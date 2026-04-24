import { Pool } from 'pg'
import { neon } from '@neondatabase/serverless'

const isProduction = process.env.NODE_ENV === 'production'
const connectionString = process.env.DATABASE_URL?.trim()

if (isProduction && !connectionString) {
  throw new Error('DATABASE_URL is required in production. Set it in your environment (e.g. Vercel).')
}

// Dev-only fallback when DATABASE_URL is unset; never used in production
const resolved =
  connectionString ||
  (process.env.NODE_ENV !== 'production' ? 'postgresql://localhost/neondb?sslmode=require' : '')
if (!resolved) {
  throw new Error('DATABASE_URL is required in production.')
}

const pool = new Pool({
  connectionString: resolved,
  ssl: resolved.includes('neon.tech') ? { rejectUnauthorized: true } : undefined,
})

// Handle connection errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export function getDbPool(): typeof pool {
  return pool
}

export default pool

// Serverless connection for Vercel edge/functions
const sql = neon(resolved)

export async function getUserGenome(userId: string) {
  const result = await sql`SELECT genome FROM users WHERE id = ${userId}`;
  return result[0]?.genome || {};
}

export async function updateGoal(userId: string, newGoal: 'SAVE' | 'REDUCE') {
  await sql`UPDATE users SET goal = ${newGoal} WHERE id = ${userId}`;
}

export async function saveUserAnswer(userId: string, answerData: any) {
  await sql`
    UPDATE users 
    SET genome = genome || ${JSON.stringify(answerData)}::jsonb
    WHERE id = ${userId}
  `;
}