/**
 * Offline audit — property intelligence mapping (no network).
 */
import { mapEpcToJourneyAnswerHints } from '@/lib/epc/mapEpcToProfileHints'
import { buildPropertyAnswerPrefill } from '@/lib/intelligence/propertyAnswerPrefill'
import { derivePropertyValueBand } from '@/lib/intelligence/landRegistryClient'
import { resolveDnoFromPostcode } from '@/lib/intelligence/dnoClient'
import { resolveZoneAuditState } from '@/lib/zone/zoneAuditUi'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'

let failed = 0

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed++
  } else {
    console.log(`✓ ${msg}`)
  }
}

const epcHints = mapEpcToJourneyAnswerHints({
  found: true,
  postcode: 'SW1A1AA',
  currentEnergyRating: 'D',
  wallsDescription: 'Solid brick, as built, no insulation (assumed)',
  windowsDescription: 'Partial double glazing',
  builtForm: 'Mid-Terrace',
  mainFuel: 'mains gas (not community)',
  mainsGasFlag: 'Y',
  heatingCostCurrent: 1200,
  lightingCostCurrent: 120,
  hotWaterCostCurrent: 180,
  currentThermalEfficiencyMultiplier: 1,
  description: 'test',
  constructionAgeBand: '1930-1949',
  tenure: 'Rented (social)',
})

assert(epcHints.home?.insulation_level === 'NONE', 'walls no insulation → NONE')
assert(epcHints.home?.glazing_type === 'DOUBLE', 'partial double → DOUBLE')
assert(epcHints.home?.property_type === 'TERRACED', 'mid-terrace → TERRACED')
assert(epcHints.home_power === 'GAS', 'mains gas → GAS')

const pi: PropertyIntelligence = {
  enrichedAt: new Date().toISOString(),
  confidence: 'ADDRESS_MATCHED',
  epc: {
    found: true,
    postcode: 'SW1A1AA',
    wallsDescription: 'no insulation',
    builtForm: 'Flat',
    currentThermalEfficiencyMultiplier: 1,
    description: 'x',
    addressMatched: true,
  },
}

const prefill = buildPropertyAnswerPrefill(pi)
assert(Boolean(prefill.answers.home?.insulation_level), 'prefill emits home.insulation_level')
assert(
  resolveZoneAuditState({
    hasVerifiedNeonMoney: false,
    genomeIncomplete: true,
    propertyIntelligenceConfidence: 'ADDRESS_MATCHED',
  }) === 'PROPERTY_VERIFIED',
  'ADDRESS_MATCHED → PROPERTY_VERIFIED badge'
)
assert(derivePropertyValueBand(450_000) === '200K_500K', 'value band mid-range')
assert(resolveDnoFromPostcode('SW1A 1AA').dnoRegion === 'UKPN', 'SW1 → UKPN')

if (failed > 0) {
  console.error(`\n[property-intelligence-audit] FAILED — ${failed} checks`)
  process.exit(1)
}
console.log('\n[property-intelligence-audit] OK')
