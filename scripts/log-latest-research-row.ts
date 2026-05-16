/**
 * Print the latest row from research_results (verification / Neon smoke).
 * Uses DATABASE_URL from .env.local via scripts/load-env-local.ts
 *
 * Production Neon (same DB as Vercel):
 *   npx tsx scripts/log-latest-research-row.ts --env-file .env.production.local
 */
import fs from 'fs'
import path from 'path'
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '../lib/db'

function loadEnvFile(relPath: string) {
  const envPath = path.join(process.cwd(), relPath)
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

async function main() {
  const envArgIdx = process.argv.indexOf('--env-file')
  const envFile =
    envArgIdx >= 0 && process.argv[envArgIdx + 1] ? process.argv[envArgIdx + 1] : undefined
  if (envFile) loadEnvFile(envFile)
  else loadEnvLocal({ preferLocal: true })
  const url = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!url) {
    console.error('DATABASE_URL missing — set in .env.local')
    process.exit(1)
  }

  const sql = neon(url)
  try {
    const rows = await sql`
      SELECT id,
             user_id,
             locality_context,
             category,
             offer_url,
             source_url,
             verified_saving,
             saving_amount_gbp,
             agent_headline,
             architect_prose,
             created_at
      FROM research_results
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `
    const row = (rows as Record<string, unknown>[])[0]
    if (!row) {
      console.log('No rows in research_results yet.')
      process.exit(0)
      return
    }
    const loc =
      typeof row.locality_context === 'string' && row.locality_context.trim()
        ? row.locality_context.trim()
        : '(no locality_context)'
    console.log('Latest research_results row')
    console.log('Location (locality_context):', loc)
    console.log(JSON.stringify(row, null, 2))
    process.exit(0)
  } catch (e) {
    console.error('db:log-research failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
