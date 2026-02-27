import { Pool } from 'pg'

// Set DATABASE_URL in production (e.g. Vercel). Fallback for local build only.
const connectionString =
  process.env.DATABASE_URL || 'postgresql://localhost/neondb?sslmode=require'

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: true } : undefined,
})

// Handle connection errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export default pool
