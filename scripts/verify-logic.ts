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
import { sumPolicySavingsGbp } from '../lib/brains/policySavingsEligibility'
import { JOURNEY_ORDER, type JourneyId } from '../lib/journeys'

const CAP = PRICE_CAP_SAVING_APRIL_1
const LEVY = GREEN_LEVY_SHIFT_APRIL_2026_GBP

type Scenario = {
  label: string
  answers: Record<string, string>
  expectPolicyGbp: number
  expectPolicyIds: string[]
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
    label: 'Profile C — New guest (no tariff / energy answers)',
    answers: {},
    expectPolicyGbp: 0,
    expectPolicyIds: [],
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
    Object.keys(scenario.answers).length === 0
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

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
