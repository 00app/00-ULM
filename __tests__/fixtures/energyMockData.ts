/**
 * Offline sandbox fixtures for the hybrid energy pipeline.
 * Raw payloads mirror production REST shapes; normalized fields match
 * `OpenEpcProfile` / `NesoGridSnapshot` consumed by `lib/zone/engineDataRouter.ts`.
 */

import type { OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import type { NesoGridSnapshot } from '@/lib/intelligence/nesoGridClient'
import type { GridTier } from '@/lib/logic/engine'

/** Postcode used across both fixtures (South East — UKPN / SSE DNO region). */
export const MOCK_SANDBOX_POSTCODE = 'BN179AA' as const

/** Open Data Communities — domestic search row (kebab-case register fields). */
export type OpenEpcDomesticRow = {
  postcode: string
  address?: string
  'lodgement-date'?: string
  'current-energy-rating'?: string
  'potential-energy-rating'?: string
  'property-type'?: string
  'main-fuel'?: string
  'walls-description'?: string
  'roof-description'?: string
  'total-floor-area'?: number
  'energy-consumption-current'?: number
  'co2-emissions-current'?: number
}

/** `GET …/api/v1/domestic/search?postcode=…` response body. */
export type OpenEpcDomesticSearchResponse = {
  rows: OpenEpcDomesticRow[]
}

/** Carbon Intensity API — regional forward 24h slot. */
export type CarbonIntensityGenerationMixEntry = {
  fuel: string
  perc: number
}

export type CarbonIntensityFw24hSlot = {
  from: string
  to: string
  intensity: {
    forecast: number
    actual?: number
    index: string
  }
  generationmix?: CarbonIntensityGenerationMixEntry[]
}

/** `GET …/regional/intensity/{outcode}/fw24h` response body (parsed by `nesoGridClient`). */
export type NesoCarbonIntensityFw24hResponse = {
  data?: CarbonIntensityFw24hSlot[]
}

export type OpenEpcEnergyFixture = {
  api: OpenEpcDomesticSearchResponse
  /** Normalized — pass to `calculateDeterministicDeltas` / `StructuralPostcodeAnchor.epc`. */
  profile: OpenEpcProfile
}

export type NesoGridEnergyFixture = {
  api: NesoCarbonIntensityFw24hResponse
  /** Normalized — pass to `calculateDeterministicDeltas` / `StructuralPostcodeAnchor.grid`. */
  snapshot: NesoGridSnapshot
}

const MOCK_EPC_ROW: OpenEpcDomesticRow = {
  postcode: 'BN17 9AA',
  address: '12 Example Street, Littlehampton',
  'lodgement-date': '2024-11-15',
  'current-energy-rating': 'D',
  'potential-energy-rating': 'C',
  'property-type': 'House',
  'main-fuel': 'mains gas (not community)',
  'walls-description': 'Solid brick, as built, no insulation (assumed)',
  'roof-description': 'Pitched, 200 mm loft insulation',
  'total-floor-area': 85,
  'energy-consumption-current': 285,
  'co2-emissions-current': 4.2,
}

const MOCK_GRID_TIER: GridTier = 'REG_GB_BASE'

const MOCK_GENERATION_MIX: CarbonIntensityGenerationMixEntry[] = [
  { fuel: 'gas', perc: 32.4 },
  { fuel: 'wind', perc: 28.5 },
  { fuel: 'nuclear', perc: 18.2 },
  { fuel: 'imports', perc: 9.1 },
  { fuel: 'biomass', perc: 5.8 },
  { fuel: 'solar', perc: 2.1 },
  { fuel: 'hydro', perc: 1.4 },
  { fuel: 'other', perc: 2.5 },
]

/**
 * Standard UK domestic EPC — band D terrace, 85 m², uninsulated solid brick walls.
 * `profile` matches `fetchOpendataEpcProfile` output for router offline tests.
 */
export const mockOpenEpcResponse: OpenEpcEnergyFixture = {
  api: {
    rows: [MOCK_EPC_ROW],
  },
  profile: {
    found: true,
    postcode: MOCK_SANDBOX_POSTCODE,
    currentEnergyRating: 'D',
    potentialEnergyRating: 'C',
    propertyType: 'House',
    mainFuel: 'mains gas (not community)',
    wallsDescription: 'Solid brick, as built, no insulation (assumed)',
    roofDescription: 'Pitched, 200 mm loft insulation',
    currentThermalEfficiencyMultiplier: 1.0,
    description:
      'type House; band D; fuel mains gas (not community); walls Solid brick, as built, no insulation (assumed); roof Pitched, 200 mm loft insulation',
    lodgementDate: '2024-11-15',
    address: '12 Example Street, Littlehampton',
  },
}

/**
 * South East regional carbon matrix — forecast 185 gCO₂/kWh, index "moderate".
 * `snapshot` matches `fetchNesoGridIntensity` output for router offline tests.
 */
export const mockNesoGridIntensityResponse: NesoGridEnergyFixture = {
  api: {
    data: [
      {
        from: '2026-05-19T00:00Z',
        to: '2026-05-19T01:00Z',
        intensity: {
          forecast: 185,
          actual: 182,
          index: 'moderate',
        },
        generationmix: MOCK_GENERATION_MIX,
      },
    ],
  },
  snapshot: {
    postcode: MOCK_SANDBOX_POSTCODE,
    outcode: 'BN17',
    intensityG: 185,
    tier: MOCK_GRID_TIER,
    source: 'carbonintensity.org.uk',
    generationMix: {
      solarPercentage: 0.021,
      windPercentage: 0.285,
    },
  },
}

/** Pair for `resolveStructuralPostcodeAnchor` / `processCalculatedLoopSpawn` mocks. */
export function mockStructuralPostcodeAnchor(): {
  postcode: string
  epc: OpenEpcProfile
  grid: NesoGridSnapshot
  source: 'skip_firecrawl'
} {
  return {
    postcode: MOCK_SANDBOX_POSTCODE,
    epc: mockOpenEpcResponse.profile,
    grid: mockNesoGridIntensityResponse.snapshot,
    source: 'skip_firecrawl',
  }
}
