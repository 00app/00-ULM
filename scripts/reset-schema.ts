import pool from '../lib/db'

async function resetSchema() {
  try {
    console.log('Dropping existing tables...')
    
    // Drop tables in reverse dependency order
    await pool.query('DROP TABLE IF EXISTS analytics_events CASCADE')
    await pool.query('DROP TABLE IF EXISTS likes CASCADE')
    await pool.query('DROP TABLE IF EXISTS journey_answers CASCADE')
    await pool.query('DROP TABLE IF EXISTS journeys CASCADE')
    await pool.query('DROP TABLE IF EXISTS cards CASCADE')
    await pool.query('DROP TABLE IF EXISTS users CASCADE')
    
    console.log('Creating new schema...')
    const schema = require('fs').readFileSync(require('path').join(process.cwd(), 'lib', 'schema.sql'), 'utf8')
    
    // Execute the entire schema as one query (PostgreSQL supports multiple statements)
    try {
      await pool.query(schema)
      console.log('Schema executed successfully')
    } catch (err: any) {
      // If that fails, try executing statements individually
      console.log('Trying individual statements...')
      const statements = schema
        .split(/;\s*(?=CREATE|INSERT|--)/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith('--') && s.match(/^(CREATE|INSERT)/))
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement + (statement.endsWith(';') ? '' : ';'))
          } catch (err2: any) {
            if (!err2.message?.includes('already exists') && !err2.message?.includes('duplicate')) {
              console.warn(`Warning: ${err2.message}`)
            }
          }
        }
      }
    }
    
    console.log('✅ Schema reset successfully')
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error resetting schema:', error)
    await pool.end()
    process.exit(1)
  }
}

resetSchema()
