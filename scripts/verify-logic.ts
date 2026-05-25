/**
 * M-1 metric verification — conditional April 2026 policy savings.
 * Run: npx tsx scripts/verify-logic.ts
 */
import { calculateUtilities } from '../lib/brains/calculations'
import { buildUserImpact } from '../lib/brains/buildUserImpact'
import {
  GREEN_LEVY_SHIFT_APRIL_2026_GBP,
  PRICE_CAP_SAVING_APRIL_1,
} from '../lib/brains/constants'
import {
  sumPolicySavingsGbp,
  type PolicySavingId,
} from '../lib/brains/policySavingsEligibility'
import { JOURNEY_ORDER, type JourneyId } from '../lib/journeys'
import {
  profileHasImpactBaseline,
  syntheticJourneyAnswersFromProfile,
} from '../lib/brains/profileJourneyBaseline'

const CAP = PRICE_CAP_SAVING_APRIL_1
const LEVY = GREEN_LEVY_SHIFT_APRIL_2026_GBP

type Scenario = {
  label: string
  answers: Record<string, string>
  expectPolicyGbp: number
  expectPolicyIds: PolicySavingId[]
  /** When true, `buildUserImpact` runs with an empty profile (no postcode baseline). */
  noProfile?: boolean
}

const SCENARIOS: Scenario[] = [
  {
    label: 'Profile A — Gas + Electric (MIXED) + VARIABLE',
    answers: {
      home_power: 'MIX',
      energy_type: 'MIXED',
      tariff_type: 'VARIABLE',
      monthly_cost: '120',
      green_tariff: 'NO',
    },
    expectPolicyGbp: CAP + LEVY,
    expectPolicyIds: ['april_price_cap_step', 'green_levy_shift'],
  },
  {
    label: 'Profile B — Electric only + VARIABLE',
    answers: {
      home_power: 'ELECTRIC',
      energy_type: 'ELECTRIC',
      tariff_type: 'VARIABLE',
      monthly_cost: '120',
      green_tariff: 'NO',
    },
    expectPolicyGbp: CAP,
    expectPolicyIds: ['april_price_cap_step'],
  },
  {
    label: 'Profile C — New guest (no profile fields, no answers)',
    answers: {},
    expectPolicyGbp: 0,
    expectPolicyIds: [],
    noProfile: true,
  },
  {
    label: 'Profile D — Gas + FIXED (locked tariff — no policy)',
    answers: {
      home_power: 'GAS',
      energy_type: 'GAS',
      tariff_type: 'FIXED',
      monthly_cost: '120',
      green_tariff: 'NO',
    },
    expectPolicyGbp: 0,
    expectPolicyIds: [],
  },
  {
    label: 'Profile E — Gas + TRACKER (dual-fuel eligible)',
    answers: {
      home_power: 'GAS',
      energy_type: 'GAS',
      tariff_type: 'TRACKER',
      monthly_cost: '120',
      green_tariff: 'YES',
    },
    expectPolicyGbp: CAP + LEVY,
    expectPolicyIds: ['april_price_cap_step', 'green_levy_shift'],
  },
]

function emptyJourneyAnswers(): Record<JourneyId, Record<string, string>> {
  return Object.fromEntries(JOURNEY_ORDER.map((jid) => [jid, {}])) as Record<
    JourneyId,
    Record<string, string>
  >
}

let passed = 0
let failed = 0

console.log('\n00-APP M-1 Policy Savings Verification\n')

for (const scenario of SCENARIOS) {
  const result =
    Object.keys(scenario.answers).length === 0 && scenario.noProfile
      ? buildUserImpact(
          { profile: {}, journeyAnswers: emptyJourneyAnswers() },
          { gridIntensityGPerKwh: 140 }
        ).perJourneyResults.utilities
      : Object.keys(scenario.answers).length === 0
        ? buildUserImpact(
            { profile: { postcode: 'SW1A1AA' }, journeyAnswers: emptyJourneyAnswers() },
            { gridIntensityGPerKwh: 140 }
          ).perJourneyResults.utilities
        : calculateUtilities(scenario.answers, undefined, undefined)

  const policyGbp = sumPolicySavingsGbp(result.policySavings ?? [])
  const policyIds = (result.policySavings ?? []).map((p) => p.id)
  const policyOk =
    policyGbp === scenario.expectPolicyGbp &&
    scenario.expectPolicyIds.every((id) => policyIds.includes(id)) &&
    policyIds.length === scenario.expectPolicyIds.length

  if (policyOk) {
    passed += 1
    console.log(`✅ ${scenario.label}`)
    console.log(`   policy savings: £${policyGbp} [${policyIds.join(', ') || 'none'}]`)
    console.log(`   total moneyGbp: £${result.moneyGbp}`)
  } else {
    failed += 1
    console.log(`❌ ${scenario.label}`)
    console.log(`   expected policy: £${scenario.expectPolicyGbp} [${scenario.expectPolicyIds.join(', ') || 'none'}]`)
    console.log(`   actual policy:   £${policyGbp} [${policyIds.join(', ') || 'none'}]`)
    console.log(`   total moneyGbp: £${result.moneyGbp}`)
  }
}

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
