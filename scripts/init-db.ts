import pool from '../lib/db'
import fs from 'fs'
import path from 'path'

async function initDatabase() {
  try {
    console.log('Initializing database schema...')
    const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement + ';')
        } catch (err: any) {
          // Ignore "already exists" errors
          if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
            console.warn(`Warning executing statement: ${err.message}`)
          }
        }
      }
    }
    
    console.log('✅ Database schema initialized successfully')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    await pool.end()
    process.exit(1)
  }
}

initDatabase()
