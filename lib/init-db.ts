import pool from './db'
import fs from 'fs'
import path from 'path'

export async function initDatabase() {
  try {
    const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8')
    await pool.query(schema)
    console.log('Database schema initialized')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}
