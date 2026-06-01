/**
 * Seed all 13 Zone wall journeys in Neon for a postcode — no dev server required.
 *
 * Usage:
 *   npm run pipeline:seed -- SW1A1AA
 *   npx tsx scripts/seed-zone-journeys-postcode.ts BN177DW
 */

import { loadEnvLocal } from './load-env-local'
import { seedMechanicalJourneysForPostcode } from '@/lib/agents/researchAgent'
import { JOURNEY_IDS } from '@/lib/journeys'

loadEnvLocal({ preferLocal: true })

async function main() {
  const postcode = (process.argv[2] ?? process.env.SEED_POSTCODE ?? 'M11AG')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()

  if (postcode.length < 5) {
    console.error('Usage: npm run pipeline:seed -- <POSTCODE>')
    console.error('Example: npm run pipeline:seed -- SW1A1AA')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL missing — add it to .env.local or run vercel pull first.')
    process.exit(1)
  }

  console.log(`Seeding ${JOURNEY_IDS.length} journeys for ${postcode}…`)
  const result = await seedMechanicalJourneysForPostcode(postcode)
  console.log(`Done: ${result.seeded}/${JOURNEY_IDS.length} journeys seeded.`)
  if (result.journeys.length > 0) {
    console.log(`Categories: ${result.journeys.join(', ')}`)
  }
  if (result.failed.length > 0) {
    console.warn(`Failed: ${result.failed.join(', ')}`)
    process.exit(1)
  }
  console.log(`Verify: npm run zone:audit-gates -- ${postcode}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
