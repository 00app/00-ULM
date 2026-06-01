/**
 * Mechanical repair — re-seed all 13 Zone wall journeys per postcode (postcode-first).
 * Delegates to `seedMechanicalJourneysForPostcode` — no BN17 hardcoding, no short headlines.
 *
 * Usage:
 *   npx tsx scripts/repair-mechanical-12k-truth.ts SW1A1AA
 *   npx tsx scripts/repair-mechanical-12k-truth.ts --all --limit=10
 *   npm run pipeline:seed -- SW1A1AA   (alias for single postcode)
 */

import { loadEnvLocal } from './load-env-local'
import {
  seedMechanicalJourneysForDistinctPostcodes,
  seedMechanicalJourneysForPostcode,
} from '@/lib/agents/researchAgent'
import { JOURNEY_IDS } from '@/lib/journeys'

loadEnvLocal({ preferLocal: true })

async function main() {
  const args = process.argv.slice(2)
  const allIdx = args.indexOf('--all')
  const seedAll = allIdx >= 0
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '10', 10) : 10
  const postcodeArg = args.find((a) => !a.startsWith('--') && a !== args[allIdx])

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL missing — add it to .env.local or run vercel pull first.')
    process.exit(1)
  }

  if (seedAll) {
    console.log(`Re-seeding ${JOURNEY_IDS.length} journeys for up to ${limit} distinct postcodes…`)
    const batch = await seedMechanicalJourneysForDistinctPostcodes(limit)
    console.log(`Done: ${batch.totalSeeded} journey rows across ${batch.postcodes.length} postcodes.`)
    if (batch.postcodes.length > 0) {
      console.log(`Postcodes: ${batch.postcodes.join(', ')}`)
    }
    return
  }

  const postcode = (postcodeArg ?? process.env.SEED_POSTCODE ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()

  if (postcode.length < 5) {
    console.error('Usage: npx tsx scripts/repair-mechanical-12k-truth.ts <POSTCODE>')
    console.error('       npx tsx scripts/repair-mechanical-12k-truth.ts --all --limit=10')
    console.error('Example: npm run pipeline:seed -- SW1A1AA')
    process.exit(1)
  }

  console.log(`Re-seeding ${JOURNEY_IDS.length} Zone wall journeys for ${postcode}…`)
  const result = await seedMechanicalJourneysForPostcode(postcode)
  console.log(`Done: ${result.seeded}/${JOURNEY_IDS.length} journeys seeded.`)
  if (result.journeys.length > 0) {
    console.log(`Categories: ${result.journeys.join(', ')}`)
  }
  console.log(`Verify: npm run zone:audit-gates -- ${postcode}`)
}

main().catch((err) => {
  console.error('Fatal mechanical repair error:', err)
  process.exit(1)
})
