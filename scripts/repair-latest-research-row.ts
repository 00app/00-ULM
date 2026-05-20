/**
 * Backfill agent_headline / architect_prose / saving_amount_gbp on incomplete Neon rows.
 * Uses GEMINI_API_KEY + FIRECRAWL_API_KEY from .env.local (or --env-file).
 *
 *   npm run db:repair-research
 *   npm run db:repair-research -- --env-file .env.production.local
 */
import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './load-env-local'
import { repairResearchResultsMissingHeadlines } from '../lib/agents/researchAgent'

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

  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Math.min(20, Math.max(1, Number.parseInt(limitArg.split('=')[1] ?? '6', 10))) : 6
  const userArg = process.argv.find((a) => a.startsWith('--user-id='))
  const userId = userArg?.split('=')[1]?.trim() || undefined
  const pcArg = process.argv.find((a) => a.startsWith('--postcode='))
  const postcode = pcArg?.split('=')[1]?.trim() || undefined
  const idArg = process.argv.find((a) => a.startsWith('--id='))
  const rowId = idArg ? Number.parseInt(idArg.split('=')[1] ?? '', 10) : undefined

  const mechanicalOnly =
    process.argv.includes('--mechanical-only') ||
    !process.argv.includes('--deep')

  const repaired = await repairResearchResultsMissingHeadlines({
    limit,
    rowId: Number.isFinite(rowId) && (rowId as number) > 0 ? (rowId as number) : null,
    userId: userId ?? null,
    postcode: postcode ?? null,
    mechanicalOnly,
  })
  console.log(`repairResearchResultsMissingHeadlines: updated ${repaired} row(s)`)
  if (repaired === 0) {
    console.log(
      'No incomplete rows repaired — check DATABASE_URL, GEMINI_API_KEY, FIRECRAWL_API_KEY, or run npm run db:log-research'
    )
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
