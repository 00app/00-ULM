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
    const incompleteCount = await sql`
      SELECT COUNT(*)::int AS n
      FROM research_results
      WHERE (agent_headline IS NULL OR TRIM(agent_headline) = '')
         OR architect_prose IS NULL OR TRIM(architect_prose) = ''
         OR saving_amount_gbp IS NULL OR COALESCE(saving_amount_gbp, 0) <= 0
    `
    const incompleteN = Number((incompleteCount as { n: number }[])[0]?.n ?? 0)

    const idArg = process.argv.find((a) => a.startsWith('--id='))
    const rowId = idArg ? Number.parseInt(idArg.split('=')[1] ?? '', 10) : NaN
    const userArg = process.argv.find((a) => a.startsWith('--user-id='))
    const userId = userArg?.split('=')[1]?.trim() ?? ''

    const rows =
      Number.isFinite(rowId) && rowId > 0
        ? await sql`
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
                   LENGTH(COALESCE(markdown, '')) AS markdown_len,
                   created_at
            FROM research_results
            WHERE id = ${rowId}
            LIMIT 1
          `
        : userId
          ? await sql`
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
                     LENGTH(COALESCE(markdown, '')) AS markdown_len,
                     created_at
              FROM research_results
              WHERE user_id = ${userId}::uuid
              ORDER BY created_at DESC NULLS LAST
              LIMIT 1
            `
          : await sql`
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
                     LENGTH(COALESCE(markdown, '')) AS markdown_len,
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
    const sav = row.saving_amount_gbp
    const hasTriplet =
      sav != null &&
      Number(sav) > 0 &&
      typeof row.agent_headline === 'string' &&
      row.agent_headline.trim().length > 0 &&
      typeof row.architect_prose === 'string' &&
      row.architect_prose.trim().length > 0
    console.log('Latest research_results row')
    console.log('Location (locality_context):', loc)
    console.log('Incomplete rows (missing £ / headline / prose):', incompleteN)
    console.log('Triplet complete on latest row:', hasTriplet ? 'yes' : 'NO — Zone will use fallbacks')
    console.log('markdown length:', row.markdown_len ?? 0)
    if (!hasTriplet) {
      console.log('')
      console.log('Fix: npm run db:repair-research  (needs GEMINI_API_KEY + FIRECRAWL_API_KEY)')
      console.log('Or re-hit scrape-sync: GET /api/scrape-sync?repair=1&postcode=YOUR_PC')
    }
    const { markdown_len: _mdLen, ...printRow } = row
    console.log(JSON.stringify(printRow, null, 2))
    process.exit(hasTriplet ? 0 : 2)
  } catch (e) {
    console.error('db:log-research failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
