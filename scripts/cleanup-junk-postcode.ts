/**
 * Remove research rows seeded with doc placeholder postcodes (e.g. YOURPOSTCODE).
 *
 *   npm run db:cleanup-junk-postcode
 *   npm run db:cleanup-junk-postcode -- YOURPOSTCODE
 *   npm run db:cleanup-junk-postcode -- --env-file .vercel/.env.production.local
 */
import { neon } from '@neondatabase/serverless'
import { loadDatabaseEnv, requireDatabaseUrl } from './resolve-database-env'

function parseArgs(argv: string[]) {
  let envFile: string | undefined
  let placeholder = 'YOURPOSTCODE'
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (arg === '--env-file') {
      envFile = argv[++i]
      continue
    }
    if (arg.startsWith('--')) continue
    placeholder = arg
    break
  }
  return { envFile, placeholder }
}

async function main() {
  const { envFile, placeholder } = parseArgs(process.argv.slice(2))
  const target = placeholder.replace(/\s+/g, '').toUpperCase()

  try {
    loadDatabaseEnv(envFile ? { envFile } : undefined)
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  let url: string
  try {
    url = requireDatabaseUrl()
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const sql = neon(url)
  const research = await sql`
    SELECT COUNT(*)::int AS n
    FROM research_results
    WHERE UPPER(REPLACE(postcode, ' ', '')) = ${target}
  `
  const scraped = await sql`
    SELECT COUNT(*)::int AS n
    FROM scraped_summary
    WHERE UPPER(REPLACE(postcode, ' ', '')) = ${target}
  `

  console.log(`research_results ${target} rows:`, research[0]?.n ?? 0)
  console.log(`scraped_summary ${target} rows:`, scraped[0]?.n ?? 0)

  if ((research[0]?.n ?? 0) > 0) {
    const del = await sql`
      DELETE FROM research_results
      WHERE UPPER(REPLACE(postcode, ' ', '')) = ${target}
      RETURNING id
    `
    console.log('deleted research_results:', del.length)
  }

  if ((scraped[0]?.n ?? 0) > 0) {
    const del2 = await sql`
      DELETE FROM scraped_summary
      WHERE UPPER(REPLACE(postcode, ' ', '')) = ${target}
      RETURNING id
    `
    console.log('deleted scraped_summary:', del2.length)
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  if (/password authentication failed/i.test(msg)) {
    console.error('Neon password rejected — DATABASE_URL in .env.local is stale or was corrupted by env merge.')
    console.error('Fix: Neon console → Connection string → pooled → replace DATABASE_URL in .env.local')
    console.error('Host must match:', 'ep-floral-recipe-abgv0qmu-pooler.eu-west-2.aws.neon.tech')
  } else {
    console.error(e)
  }
  process.exit(1)
})
