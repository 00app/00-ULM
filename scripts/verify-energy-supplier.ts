/**
 * Proves the energy-supplier feature end to end without a browser or database: the value model,
 * the calculation effect, the ranker gate and the copy personalisation. Every guarantee here is
 * one that would otherwise fail silently — a stale provider steering a switching nudge, a typed
 * "Octopus" that never reaches the calculators, a SKIP marker leaking to the server as a value.
 */

import {
  ENERGY_SUPPLIERS,
  normaliseEnergySupplier,
  resolveTypedSupplier,
  sanitiseSupplierOther,
  energySupplierName,
  providerAnswerValue,
} from '@/lib/profile/energySupplier'
import { calculateHome } from '@/lib/brains/calculations'
import { syntheticJourneyAnswersFromProfile } from '@/lib/brains/profileJourneyBaseline'
import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { eligibleActions } from '@/lib/actions/selectActions'
import { detailForSupplier } from '@/lib/actions/actionCards'
import { isProfileOnboardingCompleteFields } from '@/lib/profile/onboardingComplete'
import type { ZoneAction } from '@/lib/actions/actionTypes'

type Check = { name: string; pass: boolean; detail?: string }
const checks: Check[] = []
const assert = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail })

// --- Value model -----------------------------------------------------------------------
assert('six known suppliers', ENERGY_SUPPLIERS.length === 6)
assert('octopus slug is the one the Zone logic compares against', providerAnswerValue('octopus') === 'OCTOPUS')
for (const [typed, want] of [
  ['Octopus Energy Ltd', 'OCTOPUS'],
  ['british gas', 'BRITISH_GAS'],
  ['E.ON Next', 'EON_NEXT'],
  ['eon', 'EON_NEXT'],
  ['EDF Energy', 'EDF'],
  ['ScottishPower', 'SCOTTISH_POWER'],
  ['OVO', 'OVO'],
  ['Utilita', 'OTHER'],
] as const) {
  const r = resolveTypedSupplier(typed)
  assert(`typed "${typed}" → ${want}`, r.supplier === want, JSON.stringify(r))
}
assert('empty typed value resolves to nothing', resolveTypedSupplier('   ').supplier === '')
assert('SKIP marker is never a supplier', normaliseEnergySupplier('SKIP') === '')
assert('garbage is never a supplier', normaliseEnergySupplier('<script>') === '')
assert('other name is sanitised', !/[<>{}]/.test(sanitiseSupplierOther('<b>Tiny{Energy}</b>')))
assert('other name is capped', sanitiseSupplierOther('x'.repeat(200)).length <= 60)
assert('display name for known supplier', energySupplierName('EON_NEXT') === 'E.ON Next')
assert('display name for OTHER is the typed name', energySupplierName('OTHER', 'Utilita') === 'Utilita')
assert('OTHER with no name has no display name', energySupplierName('OTHER', '') === '')

// --- Optional: never part of completeness ------------------------------------------------
const complete = {
  name: 'A', postcode: 'BN17 5DX', livingSituation: 'ALONE', homeType: 'FLAT', homeOwnership: 'RENTER',
  powerType: 'GAS', transport: 'CAR', washPreference: 'SHOWER', flightFrequency: 'NONE', age: 'MID',
  employmentStatus: 'EMPLOYED', financialPressure: 'TIGHT', children: 'NO', helpGoal: 'CUT_BILLS', goal: 'money',
}
assert('profile is complete with no supplier', isProfileOnboardingCompleteFields(complete))
assert('profile is complete with SKIP', isProfileOnboardingCompleteFields({ ...complete, energySupplier: 'SKIP' }))

// --- Calculation -------------------------------------------------------------------------
const base = { property_type: 'FLAT', monthly_cost: '120', green_tariff: 'NO', energy_type: 'GAS' }
const unknown = calculateHome(base)
const octopus = calculateHome({ ...base, energy_provider: 'OCTOPUS' })
const british = calculateHome({ ...base, energy_provider: 'BRITISH_GAS' })
assert('Octopus customer gets no switching value', octopus.moneyGbp === Math.max(0, unknown.moneyGbp - 120),
  `unknown ${unknown.moneyGbp} octopus ${octopus.moneyGbp}`)
assert('naming a non-Octopus supplier does not inflate £', british.moneyGbp === unknown.moneyGbp,
  `unknown ${unknown.moneyGbp} british ${british.moneyGbp}`)
assert('carbon is supplier-independent', octopus.carbonKg === unknown.carbonKg && british.carbonKg === unknown.carbonKg)

// --- Baseline seeding --------------------------------------------------------------------
const seeded = syntheticJourneyAnswersFromProfile('home', { home_power: 'GAS', energy_supplier: 'OCTOPUS' })
assert('baseline seeds energy_provider for a known supplier', seeded.energy_provider === 'OCTOPUS')
const unseeded = syntheticJourneyAnswersFromProfile('home', { home_power: 'GAS', energy_supplier: 'SKIP' })
assert('baseline never seeds SKIP', !('energy_provider' in unseeded))
assert('baseline never seeds electricity/gas provider', !('electricity_provider' in seeded) && !('gas_provider' in seeded))

// --- Ranker gate -------------------------------------------------------------------------
const stub = (id: string, extra: Partial<ZoneAction>): ZoneAction => ({
  id, action: id, detail: id, verb: 'DO', cost: 'FREE', recurrence: 'ONGOING', bucket: 'utilities',
  valueGbp: 10, valueKg: 0, url: 'https://example.gov.uk/', source: 's', verifiedOn: '2026-07-31', ...extra,
})
const lib = [
  stub('only-octopus', { requires: { supplier: ['OCTOPUS'] } }),
  stub('not-octopus', { excludes: { supplier: ['OCTOPUS'] } }),
  stub('prefers-bg', { gates: { supplier: ['BRITISH_GAS'] } }),
]
const ids = (supplier: string | null) =>
  eligibleActions({ supplier, financial: 'DOING_OK' }, { library: lib, month: 1 }).map((a) => a.id).sort().join(',')
assert('requires: unknown supplier fails', !ids(null).includes('only-octopus'))
assert('requires: matching supplier passes', ids('OCTOPUS').includes('only-octopus'))
assert('excludes: unknown supplier never excludes', ids(null).includes('not-octopus'))
assert('excludes: matching supplier is removed', !ids('OCTOPUS').includes('not-octopus'))
assert('gates: unknown supplier passes', ids(null).includes('prefers-bg'))
assert('gates: other supplier is filtered', !ids('EDF').includes('prefers-bg'))

// --- Copy --------------------------------------------------------------------------------
const named = ZONE_ACTIONS.filter((a) => a.detailWithSupplier)
assert('library has supplier-aware actions', named.length >= 3)
for (const a of named) {
  assert(`${a.id}: template has a {supplier} slot`, a.detailWithSupplier!.includes('{supplier}'))
  assert(`${a.id}: names the supplier`, detailForSupplier(a, 'British Gas').includes('British Gas'))
  assert(`${a.id}: falls back with no supplier`, detailForSupplier(a, '') === a.detail && detailForSupplier(a, null) === a.detail)
}

const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error('[energy-supplier] FAILED')
  for (const f of failed) console.error(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
console.log(`[energy-supplier] OK — ${checks.length} checks passed`)
