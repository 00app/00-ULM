import { Pool } from 'pg'

// Get connection string from environment or use default
const connectionString = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_RO51JATEGYZz@ep-super-mountain-abpl2434-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? {
    rejectUnauthorized: false,
  } : undefined,
})

// Handle connection errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

export default pool
