/**
 * Synthetic UK households for dev and tests (PRD v4, Z3). Fictitious people only.
 *
 * - Deterministic: same seed and `now` → same 1,000 households, so tests and rankings are stable.
 * - Postcodes use the ZZ99 area, which is not a real UK postcode area, so nothing here can be
 *   mistaken for (or joined to) a real address.
 * - Off in production unless explicitly enabled: `isSyntheticHouseholdsEnabled()`.
 *
 * Each household carries one or more `stories` from the Z3 brief. Every story is guaranteed to
 * appear at least `count / 20` times; the rest of each profile is random within real answer values
 * (lib/journeys.ts options and action-library gate values).
 */

import type { FloodRiskZone } from '@/lib/intelligence/floodRiskClient'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { HouseholdInputs } from '@/lib/household/buildHousehold'
import type { AccountInput, StoredFactInput } from '@/lib/household/records'

export const SYNTHETIC_STORIES = [
  'broadband_out_of_contract',
  'unused_subscription',
  'gym_rarely_used',
  'insurance_renewal_up',
  'epc_d_grant_eligible',
  'fix_ending_soon',
  'unmetered_water_few_occupants',
] as const

export type SyntheticStory = (typeof SYNTHETIC_STORIES)[number]

export type SyntheticHousehold = {
  id: string
  stories: SyntheticStory[]
  inputs: HouseholdInputs
}

export const SYNTHETIC_DEFAULT_SEED = 20261025
export const SYNTHETIC_DEFAULT_COUNT = 1000

/** Dev and tests only. Production needs `HOUSEHOLD_SYNTHETIC=1` set on purpose. */
export function isSyntheticHouseholdsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.HOUSEHOLD_SYNTHETIC === '1') return true
  if (env.HOUSEHOLD_SYNTHETIC === '0') return false
  return env.NODE_ENV !== 'production'
}

/** mulberry32: small, fast, deterministic. Not for anything security-related. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000)

const LETTERS = 'ABDEFGHJLNPQRSTUWXY'
const BROADBAND = ['BT', 'Sky', 'Virgin Media', 'TalkTalk', 'Plusnet', 'Vodafone']
const MOBILE = ['EE', 'O2', 'Three', 'Vodafone', 'giffgaff']
const STREAMING = ['Netflix', 'Disney+', 'Amazon Prime', 'NOW', 'Apple TV+']
const SUPPLIERS = ['BRITISH_GAS', 'OCTOPUS', 'EDF', 'EON_NEXT', 'OVO', 'SCOTTISH_POWER', 'OTHER']
const INSURERS = ['Aviva', 'Direct Line', 'Admiral', 'AXA', 'Hastings']

export function generateSyntheticHouseholds(
  opts: { count?: number; seed?: number; now?: Date } = {}
): SyntheticHousehold[] {
  const count = opts.count ?? SYNTHETIC_DEFAULT_COUNT
  const now = opts.now ?? new Date('2026-10-25T09:00:00Z')
  const rand = prng(opts.seed ?? SYNTHETIC_DEFAULT_SEED)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]
  const chance = (p: number) => rand() < p
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

  const out: SyntheticHousehold[] = []
  for (let i = 0; i < count; i++) {
    const id = `synth-${String(i + 1).padStart(4, '0')}`
    // Guarantee coverage: the first 7 × (count/20) households cycle through the stories.
    const guaranteed = i < SYNTHETIC_STORIES.length * Math.max(1, Math.floor(count / 20))
    const stories = new Set<SyntheticStory>()
    if (guaranteed) stories.add(SYNTHETIC_STORIES[i % SYNTHETIC_STORIES.length])
    for (const s of SYNTHETIC_STORIES) if (chance(0.08)) stories.add(s)

    const asOfProfile = addDays(now, -int(10, 400)).toISOString()
    const updated = addDays(now, -int(1, 60)).toISOString()

    let tenure = pick(['OWNER', 'OWNER', 'RENTER'])
    let household = pick(['ALONE', 'COUPLE', 'FAMILY', 'SHARED'])
    const age = pick(['JUNIOR', 'MID', 'MID', 'RETIRED'])
    const employment = age === 'RETIRED' ? 'EMPLOYED' : pick(['EMPLOYED', 'EMPLOYED', 'STUDENT', 'BETWEEN_JOBS'])
    let powerType = pick(['GAS', 'GAS', 'ELECTRIC', 'MIX'])
    let financialPressure = pick(['TIGHT', 'GETTING_BY', 'DOING_OK'])
    let tariffType = pick(['FIXED', 'VARIABLE', 'TRACKER', 'UNKNOWN'])

    // The Boiler Upgrade Scheme needs an owner on gas, and the action library tags it HIGH cost, so
    // the existing cost ceiling only shows it to DOING_OK. The story pins all three.
    if (stories.has('epc_d_grant_eligible')) {
      tenure = 'OWNER'
      powerType = 'GAS'
      financialPressure = 'DOING_OK'
    }
    if (stories.has('unmetered_water_few_occupants')) household = pick(['ALONE', 'COUPLE'])
    if (stories.has('fix_ending_soon')) tariffType = 'FIXED'

    const profile: Record<string, unknown> = {
      homeOwnership: tenure,
      financialPressure,
      livingSituation: household,
      children: household === 'FAMILY' ? pick(['UNDER_5', 'SCHOOL_AGE', 'BOTH']) : 'NONE',
      employmentStatus: employment,
      age,
      powerType,
      energySupplier: pick(SUPPLIERS),
      transport: pick(['CAR', 'PUBLIC', 'BIKE', 'MIX']),
      washPreference: pick(['SHOWER', 'BATH', 'BOTH']),
      country: 'ENGLAND',
    }

    const journeyAnswers: Record<string, Record<string, unknown>> = {
      home: {
        property_type: pick(['DETACHED', 'SEMI', 'TERRACED', 'FLAT']),
        insulation_level: pick(['FULL', 'PARTIAL', 'NONE', 'UNKNOWN']),
        glazing_type: pick(['TRIPLE', 'DOUBLE', 'SINGLE', 'UNKNOWN']),
      },
      utilities: {
        tariff_type: tariffType,
        monthly_energy_band: pick(['UNDER_100', '100_TO_200', 'OVER_200', 'UNKNOWN']),
      },
      travel: { ev_hybrid: pick(['EV', 'HYBRID', 'PETROL_DIESEL', 'NONE']) },
      tech: { smart_meter: pick(['YES', 'NO', 'UNKNOWN']) },
    }

    const accounts: AccountInput[] = []
    const account = (a: Omit<AccountInput, 'id' | 'status' | 'updated_at' | 'source'> & { source?: AccountInput['source'] }) =>
      accounts.push({
        id: `${id}-acc-${accounts.length + 1}`,
        status: 'active',
        updated_at: updated,
        source: a.source ?? 'manual',
        ...a,
      })

    // Most signed-in-style households have broadband on file; the story pins it out of contract.
    if (stories.has('broadband_out_of_contract') || chance(0.5)) {
      account({
        category: 'broadband',
        provider_name: pick(BROADBAND),
        monthly_amount_pence: int(2500, 5500),
        renewal_date: null,
        contract_end_date: isoDay(
          addDays(now, stories.has('broadband_out_of_contract') ? -int(90, 150) : int(60, 540))
        ),
        source: chance(0.4) ? 'bank' : 'manual',
      })
    }
    if (chance(0.5)) {
      account({
        category: 'mobile',
        provider_name: pick(MOBILE),
        monthly_amount_pence: int(800, 4500),
        renewal_date: null,
        contract_end_date: isoDay(addDays(now, int(-200, 600))),
      })
    }
    if (stories.has('unused_subscription')) {
      const [a, b] = [pick(STREAMING), pick(STREAMING.filter((s) => s !== 'Netflix'))]
      for (const name of new Set([a, b, 'Netflix'])) {
        account({ category: 'streaming', provider_name: name, monthly_amount_pence: int(599, 1899), renewal_date: null, contract_end_date: null })
      }
    }
    if (stories.has('gym_rarely_used')) {
      account({
        category: 'membership',
        provider_name: 'Local gym',
        monthly_amount_pence: int(2000, 4500),
        renewal_date: null,
        contract_end_date: null,
        uses_per_month: int(0, 1),
      })
    } else if (chance(0.15)) {
      account({
        category: 'membership',
        provider_name: 'Local gym',
        monthly_amount_pence: int(2000, 4500),
        renewal_date: null,
        contract_end_date: null,
        uses_per_month: int(4, 14),
      })
    }
    if (stories.has('insurance_renewal_up')) {
      account({
        category: chance(0.5) ? 'home_insurance' : 'car_insurance',
        provider_name: pick(INSURERS),
        monthly_amount_pence: int(2500, 9000),
        renewal_date: isoDay(addDays(now, int(5, 28))),
        contract_end_date: null,
      })
    }
    if (stories.has('fix_ending_soon')) {
      account({
        category: 'electricity',
        provider_name: null,
        monthly_amount_pence: int(6000, 16000),
        renewal_date: null,
        contract_end_date: isoDay(addDays(now, int(7, 45))),
        is_fixed: true,
      })
    }

    const storedFacts: StoredFactInput[] = []
    if (stories.has('unmetered_water_few_occupants')) {
      const occupants = household === 'ALONE' ? 1 : 2
      storedFacts.push(
        {
          category: 'water',
          field_key: 'occupants',
          value: occupants,
          source_kind: 'told_us',
          source_name: 'You told us',
          source_url: null,
          as_of: asOfProfile,
          confidence: 'medium',
          confidence_reason: 'From what you told us.',
          tier: 2,
        },
        {
          category: 'water',
          field_key: 'bedrooms',
          value: occupants + int(1, 2),
          source_kind: 'public',
          source_name: 'Synthetic property record',
          source_url: null,
          as_of: asOfProfile,
          confidence: 'high',
          confidence_reason: 'From the property record.',
          tier: 1,
        }
      )
    }

    const loopAnswers: Record<string, string> = {}
    if (stories.has('unmetered_water_few_occupants')) loopAnswers.water_meter_save = 'NO METER'

    const epcBand = stories.has('epc_d_grant_eligible') ? 'D' : pick(['B', 'C', 'C', 'D', 'E'])
    const property: PropertyIntelligence = {
      epc: {
        found: true,
        postcode: '',
        currentEnergyRating: epcBand,
        potentialEnergyRating: pick(['B', 'C']),
        mainFuel: powerType === 'GAS' ? 'mains gas (not community)' : 'electricity',
        wallsDescription: pick(['Cavity wall, as built, no insulation', 'Cavity wall, filled cavity', 'Solid brick, as built']),
        roofDescription: pick(['Pitched, 100 mm loft insulation', 'Pitched, 270 mm loft insulation', '(another dwelling above)']),
        currentThermalEfficiencyMultiplier: 1,
        description: 'Synthetic EPC',
        lodgementDate: isoDay(addDays(now, -int(200, 3000))),
        isStale: false,
        addressMatched: true,
      },
      flood: { found: true, floodRiskZone: pick<FloodRiskZone>(['LOW', 'LOW', 'MEDIUM']) },
      enrichedAt: addDays(now, -int(1, 30)).toISOString(),
      confidence: 'ADDRESS_MATCHED',
    }

    const postcode = `ZZ99 ${int(1, 9)}${LETTERS[int(0, LETTERS.length - 1)]}${LETTERS[int(0, LETTERS.length - 1)]}`
    property.epc!.postcode = postcode.replace(' ', '')

    out.push({
      id,
      stories: [...stories],
      inputs: {
        identity: { kind: 'synthetic', syntheticId: id },
        postcode,
        profile,
        profileAsOf: asOfProfile,
        journeyAnswers,
        journeyAnswersAsOf: asOfProfile,
        loopAnswers,
        loopAnswersAsOf: updated,
        property,
        accounts,
        bank: null,
        storedFacts,
      },
    })
  }
  return out
}
