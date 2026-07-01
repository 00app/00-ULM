#!/usr/bin/env npx tsx
import { loadEnvLocal } from './load-env-local'
loadEnvLocal()
import { getDbPool } from '../lib/db'

async function main() {
  const pool = getDbPool()
  const r = await pool.query("DELETE FROM research_results WHERE postcode ILIKE 'BN17%'")
  console.log(`Deleted ${r.rowCount} BN17 research rows`)
}
main().catch(console.error)
