/**
 * Profile baseline verification.
 * Run: npx tsx scripts/verify-logic.ts
 */
import { calculateUtilities } from '../lib/brains/calculations'
import { buildUserImpact } from '../lib/brains/buildUserImpact'
import { JOURNEY_ORDER, type JourneyId } from '../lib/journeys'
import {
  profileHasImpactBaseline,
  syntheticJourneyAnswersFromProfile,
} from '../lib/brains/profileJourneyBaseline'

function emptyJourneyAnswers(): Record<JourneyId, Record<string, string>> {
  return Object.fromEntries(JOURNEY_ORDER.map((jid) => [jid, {}])) as Record<
    JourneyId,
    Record<string, string>
  >
}

let passed = 0
let failed = 0

console.log('\n00-APP Profile baseline (Gary / BN77 — empty journey answers)\n')

const garyProfile = {
  name: 'Gary',
  postcode: 'BN77 7AA',
  home_type: 'HOUSE',
  household: 'FAMILY',
  transport_baseline: 'CAR',
  home_power: 'GAS',
} as const

const garyEmpty = emptyJourneyAnswers()
const garyImpact = buildUserImpact(
  { profile: garyProfile, journeyAnswers: garyEmpty },
  { gridIntensityGPerKwh: 129 }
)

if (!profileHasImpactBaseline(garyProfile)) {
  failed += 1
  console.log('❌ Gary profile should qualify for impact baseline')
} else {
  passed += 1
  console.log('✅ profileHasImpactBaseline (Gary BN77)')
}

let garyZeroJourneys = 0
for (const jid of JOURNEY_ORDER) {
  const j = garyImpact.perJourneyResults[jid]
  if (j.moneyGbp <= 0 && j.carbonKg <= 0) garyZeroJourneys += 1
}

if (garyZeroJourneys > 4) {
  failed += 1
  console.log(`❌ Too many zero journeys (${garyZeroJourneys}/13) — synthetic baseline broken`)
} else {
  passed += 1
  console.log(
    `✅ Zone estimates: ${13 - garyZeroJourneys}/13 journeys non-zero (totals £${garyImpact.totals.totalMoney}, ${(garyImpact.totals.totalCarbon / 1000).toFixed(1)}t CO₂)`
  )
}

const synthUtilities = syntheticJourneyAnswersFromProfile('utilities', garyProfile)
const utilFromSynth = calculateUtilities(synthUtilities, undefined, undefined)
if (utilFromSynth.moneyGbp > 0) {
  passed += 1
  console.log(`✅ utilities synthetic answers → £${utilFromSynth.moneyGbp}`)
} else {
  failed += 1
  console.log('❌ utilities synthetic answers returned £0')
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
