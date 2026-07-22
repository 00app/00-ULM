/**
 * Onboarding → intelligence funnel verification.
 * Ensures profile fields drive JIT scrape priorities and goal-weighted zone ranking.
 */

import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { goalSortWeights } from '@/lib/profile/goalWeighting'
import { buildAnswerFunnel } from '@/lib/intelligence/answerFunnelRouter'
import { resolveOnboardingResearchJourneys } from '@/lib/zone/onboardingResearchBootstrap'
import { buildGuardrailedResearchProfile } from '@/lib/profile/onboardingGuardrails'
import { isProfileOnboardingCompleteFields } from '@/lib/profile/onboardingComplete'
import { isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { resolveAffluenceAuditMode } from '@/lib/zone/affluenceCheck'
import { isStudent, isBetweenJobs } from '@/lib/profile/employmentSegment'
import {
  formatSoloFocusNavTipLabel,
  isBannedSoloFocusNavTipFragment,
  navRailDestinationLabel,
} from '@/lib/zone/soloFocusNavLabels'
import {
  soloFocusNavNeighbors,
  type SoloFocusNavEntry,
} from '@/lib/zone/soloFocusJourneyNav'
import {
  resolveSoloFocusCtaLabel,
  resolveSoloFocusHandoffUrls,
} from '@/lib/soloFocusCopy'

type Check = { name: string; pass: boolean; detail?: string }

const checks: Check[] = []

function assert(name: string, pass: boolean, detail?: string): void {
  checks.push({ name, pass, detail })
}

const BASE_PROFILE = {
  name: 'Alex',
  postcode: 'M11AG',
  livingSituation: 'family',
  homeType: 'semi',
  homeOwnership: 'OWNER',
  powerType: 'gas_electric',
  transport: 'car',
  washPreference: 'SHOWER',
  flightFrequency: 'ONE_TWO',
  age: 'MID',
  employmentStatus: 'EMPLOYED',
  goal: 'money',
}

assert('onboarding complete requires all fields + goal', isProfileOnboardingCompleteFields(BASE_PROFILE))
assert('onboarding rejects missing goal', !isProfileOnboardingCompleteFields({ ...BASE_PROFILE, goal: '' }))
assert('postcode validation accepts UK format', isValidUkPostcode('M11AG'))

for (const goal of ['money', 'carbon', 'balanced'] as const) {
  const weights = goalSortWeights(goal)
  const sum = weights.money + weights.carbon
  assert(`goal ${goal} weights sum to 1`, Math.abs(sum - 1) < 0.001, `${weights.money}/${weights.carbon}`)
}

const moneyJit = resolveOnboardingResearchJourneys({
  goal: 'money',
  home_power: 'gas_electric',
  employment_status: 'employed',
  postcode: 'M11AG',
})
const carbonJit = resolveOnboardingResearchJourneys({
  goal: 'carbon',
  home_power: 'gas_electric',
  employment_status: 'employed',
  postcode: 'M11AG',
})

assert('money goal prioritises money journey', moneyJit.includes('money'), moneyJit.join(','))
assert('carbon goal prioritises carbon journey', carbonJit.includes('carbon'), carbonJit.join(','))
assert('onboarding JIT includes home', moneyJit.includes('home'))
assert('utilities unlock adds utilities JIT', resolveOnboardingResearchJourneys({
  goal: 'balanced',
  home_power: 'gas_electric',
  postcode: 'M11AG',
}).includes('utilities'))

const funnel = buildAnswerFunnel({
  profile: buildGuardrailedResearchProfile(BASE_PROFILE, { postcode: 'M11AG' }),
  cap: 4,
})
assert('answer funnel returns capped journeys', funnel.priorityJourneys.length <= 4)
assert('answer funnel always seeds home', funnel.priorityJourneys.includes('home'))

const profileVariants: Array<{
  label: string
  params: Parameters<typeof resolveOnboardingResearchJourneys>[0]
  expectJourney: JourneyId
}> = [
  {
    label: 'carbon + travel answers',
    params: {
      goal: 'carbon',
      home_power: 'gas_electric',
      employment_status: 'employed',
      postcode: 'M11AG',
      journeyAnswers: { travel: { commute: 'train', mode: 'rail' } },
    },
    expectJourney: 'travel',
  },
  {
    label: 'balanced family',
    params: {
      goal: 'balanced',
      home_power: 'gas_electric',
      employment_status: 'employed',
      postcode: 'M11AG',
    },
    expectJourney: 'travel',
  },
  {
    label: 'money saver',
    params: {
      goal: 'money',
      home_power: 'gas_electric',
      employment_status: 'employed',
      postcode: 'M11AG',
    },
    expectJourney: 'money',
  },
]

for (const variant of profileVariants) {
  const jit = resolveOnboardingResearchJourneys(variant.params)
  assert(
    `${variant.label} → tailored JIT includes ${variant.expectJourney}`,
    jit.includes(variant.expectJourney),
    jit.join(',')
  )
}

assert(
  'money vs carbon JIT lists differ by goal',
  moneyJit.join(',') !== carbonJit.join(',')
)

assert(
  'all JIT journeys are valid',
  [...moneyJit, ...carbonJit].every((j) => JOURNEY_ORDER.includes(j))
)

const studentJit = resolveOnboardingResearchJourneys({
  goal: 'money',
  home_power: 'gas_electric',
  employment_status: 'STUDENT',
  postcode: 'M11AG',
})
assert('student profile prioritises food in JIT', studentJit.includes('food'), studentJit.join(','))

const betweenJobsAff = resolveAffluenceAuditMode({
  employment_status: 'BETWEEN_JOBS',
  postcode: 'M11AG',
})
assert('between jobs uses bill survival mode', betweenJobsAff.mode === 'bill_survival')
assert('student is not active employed', !isStudent('EMPLOYED') && isStudent('STUDENT'))
assert('legacy unemployed maps to between jobs segment', isBetweenJobs('UNEMPLOYED'))

assert(
  'banned nav fragment detects remember copy',
  isBannedSoloFocusNavTipFragment('We remember this choice')
)
assert(
  'achievement tip label falls back not remember prose',
  !formatSoloFocusNavTipLabel('YOUR WALL NOW REMEMBERS THIS SHIFT', 'home').includes('remember')
)
assert('nav rail destination is uppercase category', navRailDestinationLabel('solar') === 'SOLAR')

const soloNavRing: SoloFocusNavEntry[] = [
  { cardId: 'tip-money-ach', journeyKey: 'money', kind: 'tip', label: 'we remember' },
  { cardId: 'journey-solar', journeyKey: 'solar', kind: 'journey', label: 'SOLAR' },
  { cardId: 'tip-tech', journeyKey: 'tech', kind: 'tip', label: 'tech +' },
]
const solarNeighbors = soloFocusNavNeighbors('journey-solar', soloNavRing, 'solar')
assert(
  'solar prev nav label is money category',
  solarNeighbors?.prevLabel === 'MONEY',
  solarNeighbors?.prevLabel
)
assert(
  'solar next nav label is tech category',
  solarNeighbors?.nextLabel === 'TECH',
  solarNeighbors?.nextLabel
)

const grantHandoff = resolveSoloFocusHandoffUrls({
  journeyKey: 'home',
  coverageOfferUrl: 'https://www.gov.uk/the-warm-home-discount-scheme',
  coverageSourceUrl: 'https://www.energysavingtrust.org.uk/',
  fallbackOfferUrl: 'https://www.currys.co.uk/search?q=energy',
  buildZaiUrl: () => '/zai?context=home',
})
assert(
  'solo focus cta uses offer_url not source_url',
  grantHandoff.ctaUrl.includes('warm-home-discount'),
  grantHandoff.ctaUrl
)
assert(
  'solo focus source link stays on source_url',
  grantHandoff.sourceLinkUrl.includes('energysavingtrust'),
  grantHandoff.sourceLinkUrl
)
assert(
  'solo focus grant cta label matches offer',
  resolveSoloFocusCtaLabel({
    journeyKey: 'home',
    headline: 'Warm home discount',
    handoff: grantHandoff,
    moneyGbp: 150,
  }) === 'Claim'
)

const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error('[onboarding-intelligence] FAILED')
  for (const f of failed) {
    console.error(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  }
  process.exit(1)
}

console.log(`[onboarding-intelligence] OK — ${checks.length} checks passed`)
