/**
 * List per-journey research gate failures for a postcode (Neon latest row per category).
 *
 *   npm run zone:audit-gates -- BN17 7DH
 *   npm run zone:audit-gates -- --env-file .env.production.local SW1A 1AA
 */
import fs from 'fs'
import path from 'path'
import { neon } from '@neondatabase/serverless'
import { loadEnvLocal } from './load-env-local'
import { sanitizeNeonConnectionString } from '../lib/db'
import { JOURNEY_ORDER } from '../lib/journeys'
import type { ResearchCategoryCoverageRow } from '../lib/researchSyncClient'
import { auditAllJourneyResearchGates } from '../lib/zone/researchGateAudit'

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

function mapCoverageRows(
  rows: Array<{
    cat: string
    architect_prose: string | null
    agent_headline: string | null
    offer_url: string | null
    source_url: string | null
    saving_amount_gbp: unknown
    verified_saving: unknown
    verified: unknown
  }>
): Record<string, ResearchCategoryCoverageRow> {
  const out: Record<string, ResearchCategoryCoverageRow> = {}
  const toNum = (v: unknown): number | null => {
    if (v == null) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  for (const row of rows) {
    const k = String(row.cat || '').trim().toLowerCase()
    if (!k) continue
    const prose = typeof row.architect_prose === 'string' ? row.architect_prose.trim() : ''
    const headline = typeof row.agent_headline === 'string' ? row.agent_headline.trim() : ''
    const offer = typeof row.offer_url === 'string' ? row.offer_url.trim() : ''
    const src = typeof row.source_url === 'string' ? row.source_url.trim() : ''
    const sav = toNum(row.saving_amount_gbp)
    const ver = toNum(row.verified_saving)
    const hasOffer = offer.startsWith('http')
    const hasSrc = src.startsWith('http')
    out[k] = {
      insightReady:
        prose.length > 0 ||
        headline.length > 0 ||
        (sav != null && sav > 0) ||
        (ver != null && ver > 0) ||
        hasOffer,
      hasOffer,
      verified: row.verified === true,
      latestSavingGbp: sav,
      latestVerifiedGbp: ver,
      latestOfferUrl: hasOffer ? offer.slice(0, 2048) : null,
      latestSourceUrl: hasSrc ? src.slice(0, 2048) : null,
      architectProse: prose.length > 0 ? prose.slice(0, 4000) : null,
      agentHeadline: headline.length > 0 ? headline.slice(0, 320) : null,
    }
  }
  return out
}

async function main() {
  const envArgIdx = process.argv.indexOf('--env-file')
  const envFile =
    envArgIdx >= 0 && process.argv[envArgIdx + 1] ? process.argv[envArgIdx + 1] : undefined
  if (envFile) loadEnvFile(envFile)
  else loadEnvLocal({ preferLocal: true })

  const postcodeParts = process.argv
    .slice(2)
    .filter((a) => a !== '--env-file' && !a.startsWith('--env-file'))
    .filter((a, i, arr) => !(i > 0 && arr[i - 1] === '--env-file'))
  const postcodeRaw = postcodeParts.join(' ').trim()
  if (postcodeRaw.length < 4) {
    console.error('Usage: npm run zone:audit-gates -- <POSTCODE> [--env-file .env.production.local]')
    process.exit(1)
  }

  const pc = postcodeRaw.replace(/\s+/g, '').toUpperCase()
  const url = sanitizeNeonConnectionString(process.env.DATABASE_URL?.trim() ?? '')
  if (!url) {
    console.error('DATABASE_URL missing')
    process.exit(1)
  }

  const sql = neon(url)
  const rows = await sql`
    SELECT DISTINCT ON (lower(trim(rr.category)))
      lower(trim(rr.category)) AS cat,
      rr.architect_prose,
      rr.agent_headline,
      rr.offer_url,
      rr.source_url,
      rr.saving_amount_gbp,
      rr.verified_saving,
      rr.verified
    FROM research_results rr
    WHERE REPLACE(COALESCE(rr.postcode, ''), ' ', '') = ${pc}
      AND rr.category IS NOT NULL
      AND btrim(rr.category) <> ''
    ORDER BY lower(trim(rr.category)), rr.created_at DESC NULLS LAST
  `

  const coverage = mapCoverageRows(rows as Parameters<typeof mapCoverageRows>[0])
  const reports = auditAllJourneyResearchGates(coverage)

  console.log(`\n━━━ Zone research gates — ${postcodeRaw} (${pc}) ━━━\n`)
  let unsettled = 0
  let missing = 0
  for (const r of reports) {
    const mark =
      r.status === 'settled' ? '✓' : r.status === 'missing' ? '○' : '✗'
    if (r.status === 'unsettled') unsettled += 1
    if (r.status === 'missing') missing += 1
    const £ =
      r.savingGbp != null && r.savingGbp > 0 ? ` £${Math.round(r.savingGbp)}` : ''
    const issues = r.issues.length ? ` — ${r.issues.join(', ')}` : ''
    console.log(
      `${mark} ${r.journeyId.padEnd(11)} ${r.status.padEnd(10)}${£}${r.hasOffer ? ' offer' : ''}${issues}`
    )
    if (r.status === 'unsettled') {
      const row = coverage[r.journeyId] ?? coverage[r.journeyId.toLowerCase()]
      const hl = row?.agentHeadline?.trim()
      if (hl) console.log(`    headline: ${hl.slice(0, 72)}${hl.length > 72 ? '…' : ''}`)
    }
  }

  const settled = reports.filter((r) => r.status === 'settled').length
  console.log(
    `\nSummary: ${settled}/${JOURNEY_ORDER.length} settled · ${unsettled} unsettled · ${missing} missing\n`
  )
  console.log('Repair hints: npm run pipeline:seed --', postcodeRaw, '| npm run db:repair-research')
  process.exit(unsettled + missing > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
