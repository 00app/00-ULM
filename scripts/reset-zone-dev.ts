/**
 * Dev reset: clear Neon visit breadcrumbs + print browser storage keys to wipe.
 *
 *   npm run zone:reset-dev
 *   npm run zone:reset-dev -- --env-file .env.production.local
 */
import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'
import { getDbPool } from '../lib/db'

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

  const pool = getDbPool()

  await pool.query(`
    ALTER TABLE guest_sessions
      ADD COLUMN IF NOT EXISTS visited_card_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS visited_journey_keys JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  const cleared = await pool.query(`
    UPDATE guest_sessions
    SET visited_card_ids = '[]'::jsonb,
        visited_journey_keys = '[]'::jsonb
    WHERE visited_card_ids <> '[]'::jsonb
       OR visited_journey_keys <> '[]'::jsonb
  `)
  console.log(`[zone:reset-dev] cleared visit columns on ${cleared.rowCount ?? 0} guest_sessions rows`)

  console.log(`
[zone:reset-dev] In the browser (DevTools → Application), remove:
  localStorage: visited_cards, profile_postcode (optional), expand_card
  sessionStorage: zz_session_memory, zz_summary_to_zone, zz_deep_dive_in_progress

Then hard-refresh /zone (Cmd+Shift+R).
`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
