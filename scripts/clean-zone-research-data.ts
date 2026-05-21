/**
 * Neon hygiene: dedupe research_results, null bad offer URLs, apply guest_sessions visit columns.
 *
 *   npm run db:clean-zone
 *   npm run db:clean-zone -- --env-file .env.production.local
 *   npm run db:clean-zone -- --dry-run
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
  const dryRun = process.argv.includes('--dry-run')
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

  const dupes = await pool.query<{ n: string }>(`
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY
            COALESCE(user_id::text, ''),
            REPLACE(COALESCE(postcode, ''), ' ', ''),
            lower(trim(COALESCE(category, '')))
          ORDER BY created_at DESC NULLS LAST
        ) AS rn
      FROM research_results
      WHERE category IS NOT NULL AND btrim(category) <> ''
    )
    SELECT COUNT(*)::text AS n FROM ranked WHERE rn > 1
  `)
  const dupeCount = Number.parseInt(dupes.rows[0]?.n ?? '0', 10)
  console.log(`[clean-zone] duplicate category rows to delete: ${dupeCount}`)

  if (!dryRun && dupeCount > 0) {
    const del = await pool.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY
              COALESCE(user_id::text, ''),
              REPLACE(COALESCE(postcode, ''), ' ', ''),
              lower(trim(COALESCE(category, '')))
            ORDER BY created_at DESC NULLS LAST
          ) AS rn
        FROM research_results
        WHERE category IS NOT NULL AND btrim(category) <> ''
      )
      DELETE FROM research_results
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `)
    console.log(`[clean-zone] deleted ${del.rowCount ?? 0} duplicate rows`)
  }

  const badUrlPreview = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text AS n FROM research_results
    WHERE offer_url ~* 'great-british-insulation|energy-insulation/the-great'
       OR offer_url ~* '^https://(www\\.)?gov\\.uk/?$'
       OR offer_url ~* '^https://(www\\.)?ofgem\\.gov\\.uk/?$'
       OR source_url ~* '^https://(www\\.)?gov\\.uk/?$'
  `)
  const badN = Number.parseInt(badUrlPreview.rows[0]?.n ?? '0', 10)
  console.log(`[clean-zone] rows with blocked/generic URLs to null: ${badN}`)

  if (!dryRun && badN > 0) {
    const upd = await pool.query(`
      UPDATE research_results
      SET offer_url = CASE
            WHEN offer_url ~* 'great-british-insulation|energy-insulation/the-great'
              OR offer_url ~* '^https://(www\\.)?gov\\.uk/?$'
              OR offer_url ~* '^https://(www\\.)?ofgem\\.gov\\.uk/?$'
            THEN NULL
            ELSE offer_url
          END,
          source_url = CASE
            WHEN source_url ~* '^https://(www\\.)?gov\\.uk/?$'
            THEN NULL
            ELSE source_url
          END
      WHERE offer_url ~* 'great-british-insulation|energy-insulation/the-great'
         OR offer_url ~* '^https://(www\\.)?gov\\.uk/?$'
         OR offer_url ~* '^https://(www\\.)?ofgem\\.gov\\.uk/?$'
         OR source_url ~* '^https://(www\\.)?gov\\.uk/?$'
    `)
    console.log(`[clean-zone] nulled URLs on ${upd.rowCount ?? 0} rows`)
  }

  const stale = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text AS n FROM research_results
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND user_id IS NULL
      AND category IS NULL
  `)
  const staleN = Number.parseInt(stale.rows[0]?.n ?? '0', 10)
  console.log(`[clean-zone] orphan rows older than 90d (no user/category): ${staleN}`)
  if (!dryRun && staleN > 0) {
    const delStale = await pool.query(`
      DELETE FROM research_results
      WHERE created_at < NOW() - INTERVAL '90 days'
        AND user_id IS NULL
        AND category IS NULL
    `)
    console.log(`[clean-zone] deleted ${delStale.rowCount ?? 0} stale orphan rows`)
  }

  if (dryRun) console.log('[clean-zone] dry-run — no mutations applied')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
