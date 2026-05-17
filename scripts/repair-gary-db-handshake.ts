/**
 * Repair Gary demo user + relink orphan research_results rows.
 * Usage: npx tsx scripts/repair-gary-db-handshake.ts [POSTCODE]
 * Requires DATABASE_URL (e.g. from .env.local).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

if (!process.env.DATABASE_URL) {
  const envPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^DATABASE_URL=(.+)$/)
      if (m) process.env.DATABASE_URL = m[1]!.replace(/^["']|["']$/g, '')
    }
  }
}

import { ensureGaryDemoUser, relinkOrphanResearchToGary } from '@/lib/db/ensureGaryDemoUser'

async function main() {
  const pc = (process.argv[2] ?? 'BN177DW').replace(/\s+/g, '').trim().toUpperCase()
  await ensureGaryDemoUser(pc)
  const n = await relinkOrphanResearchToGary()
  console.log(`✅ Gary demo user ensured (${pc}); relinked ${n} research_results row(s).`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
