/**
 * Utilities lane — free UK web APIs (no API keys).
 * Composes Postcodes.io + Carbon Intensity + optional Octopus public tariff feed.
 * Ofgem unit rates remain constants / Firecrawl / Gemini extraction — not invented here.
 */

import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'
import { fetchNesoGridIntensity } from '@/lib/intelligence/nesoGridClient'
import {
  APRIL_2026_TRUTH_PENCE,
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_SOURCE_URL,
} from '@/lib/brains/constants'
import { profileHomePowerToEnergyType } from '@/lib/profile/homePower'
import {
  fetchUkInfrastructureFeed,
  formatUkInfrastructureFeedBlock,
  type UkInfrastructureFeed,
} from '@/lib/data/ukPublicInfrastructureApis'
import {
  fetchOctopusMarketSnapshot,
  formatOctopusMarketBlock,
  getIndicativeAgilePPerKwh,
  type OctopusMarketSnapshot,
} from '@/lib/data/octopusPublicApis'

export type UtilitiesFreeApiId =
  | 'postcodes.io'
  | 'carbonintensity.org.uk'
  | 'octopus.energy'
  | 'ofgem.gov.uk'
  | 'environment.data.gov.uk'
  | 'uk-air.defra.gov.uk'

/** Registry for docs / Hermes — browser must use server proxies only. */
export const UTILITIES_FREE_API_REGISTRY: ReadonlyArray<{
  id: UtilitiesFreeApiId
  baseUrl: string
  auth: 'none'
  lane: 'utilities' | 'carbon' | 'home' | 'water'
  use: string
}> = [
  {
    id: 'postcodes.io',
    baseUrl: 'https://api.postcodes.io',
    auth: 'none',
    lane: 'utilities',
    use: 'Council / region anchor for tariff and grid context',
  },
  {
    id: 'carbonintensity.org.uk',
    baseUrl: 'https://api.carbonintensity.org.uk',
    auth: 'none',
    lane: 'utilities',
    use: 'National /intensity + /generation mix; regional postcode intensity',
  },
  {
    id: 'environment.data.gov.uk',
    baseUrl: 'https://environment.data.gov.uk/flood-monitoring',
    auth: 'none',
    lane: 'water',
    use: 'Water journey — EA live readings sample (England stations)',
  },
  {
    id: 'octopus.energy',
    baseUrl: 'https://api.octopus.energy',
    auth: 'none',
    lane: 'utilities',
    use: 'Product matrix + half-hourly Agile rates (electric / mixed homes)',
  },
  {
    id: 'uk-air.defra.gov.uk',
    baseUrl: 'https://air-quality-api.open-meteo.com',
    auth: 'none',
    lane: 'carbon',
    use: 'EAQI at postcode (Open-Meteo fallback; Defra legacy JSON retired)',
  },
  {
    id: 'ofgem.gov.uk',
    baseUrl: 'https://www.ofgem.gov.uk',
    auth: 'none',
    lane: 'utilities',
    use: 'Price-cap hub URL for citations; live HTML parse via /api/pulse/living',
  },
]

export type UtilitiesPublicSnapshot = {
  postcode: string
  outcode: string
  home_power: string
  energy_type: string
  council?: string
  region?: string
  localCarbonGPerKwh?: number
  gridSource: 'carbonintensity.org.uk' | 'tier_fallback'
  /** April 2026 mechanical reference — not from a live Ofgem REST API */
  referenceCapGbp: number
  referenceElecPPerKwh: number
  referenceGasPPerKwh: number
  priceCapSourceUrl: string
  agilePPerKwh?: number | null
  /** NESO intensity + national mix + EA water + Defra AQI (zero-auth). */
  ukInfrastructure?: UkInfrastructureFeed
  /** Octopus catalogue + Agile slots when home is electric or mixed. */
  octopusMarket?: OctopusMarketSnapshot
  fetchedAt: string
}

function compactPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').trim().toUpperCase()
}

/** Read power type from profile field or nested journey answers in user_genome. */
export function readHomePowerFromGenome(
  genome: Record<string, unknown> | null | undefined
): string {
  if (!genome || typeof genome !== 'object') return ''
  const direct =
    (typeof genome.home_power === 'string' && genome.home_power) ||
    (typeof genome.profile_home_power === 'string' && genome.profile_home_power) ||
    ''
  if (direct.trim()) return direct.trim().toUpperCase()

  const journey = genome.journey_answers_jsonb
  if (journey && typeof journey === 'object' && !Array.isArray(journey)) {
    const utils = (journey as Record<string, unknown>).utilities
    if (utils && typeof utils === 'object' && !Array.isArray(utils)) {
      const hp = (utils as Record<string, unknown>).home_power
      if (typeof hp === 'string' && hp.trim()) return hp.trim().toUpperCase()
    }
  }

  const flatUtils = genome.utilities
  if (flatUtils && typeof flatUtils === 'object' && !Array.isArray(flatUtils)) {
    const hp = (flatUtils as Record<string, unknown>).home_power
    if (typeof hp === 'string' && hp.trim()) return hp.trim().toUpperCase()
  }
  return ''
}

/**
 * Free public snapshot for utilities JIT / scrape-sync (server-side only).
 */
export async function fetchUtilitiesPublicSnapshot(params: {
  postcode: string
  homePower?: string | null
}): Promise<UtilitiesPublicSnapshot | null> {
  const postcode = compactPostcode(params.postcode)
  if (postcode.length < 4) return null

  const home_power = String(params.homePower ?? '')
    .trim()
    .toUpperCase()
  const energy_type = profileHomePowerToEnergyType(home_power)

  const wantsOctopus =
    home_power === 'ELECTRIC' || home_power === 'MIX' || energy_type === 'MIXED'

  const [local, grid, ukInfrastructure, octopusMarket] = await Promise.all([
    getLocalData(postcode).catch(() => null),
    fetchNesoGridIntensity(postcode).catch(() => null),
    fetchUkInfrastructureFeed({ postcode }).catch(() => null),
    wantsOctopus
      ? fetchOctopusMarketSnapshot({ includeAgileSlots: true, productSample: 5 }).catch(
          () => null
        )
      : Promise.resolve(null),
  ])
  const outcode = (local?.outcode ?? postcode.slice(0, 4)).toUpperCase()

  let agilePPerKwh: number | null = octopusMarket?.agile?.slots?.[0]?.value_inc_vat ?? null
  if (agilePPerKwh == null && wantsOctopus) {
    agilePPerKwh = await getIndicativeAgilePPerKwh().catch(() => null)
  }

  return {
    postcode,
    outcode,
    home_power,
    energy_type,
    council: local?.council,
    region: local?.region,
    localCarbonGPerKwh: grid?.intensityG ?? local?.localCarbonG,
    gridSource: grid?.source ?? 'tier_fallback',
    referenceCapGbp: PRICE_CAP_APRIL_2026,
    referenceElecPPerKwh: APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH,
    referenceGasPPerKwh: APRIL_2026_TRUTH_PENCE.GAS_PER_KWH,
    priceCapSourceUrl: PRICE_CAP_SOURCE_URL,
    agilePPerKwh,
    ukInfrastructure: ukInfrastructure ?? undefined,
    octopusMarket: octopusMarket ?? undefined,
    fetchedAt: new Date().toISOString(),
  }
}

/** Markdown block for Gemini / Firecrawl prefix — lane: utilities only. */
export function formatUtilitiesPublicFeedBlock(snapshot: UtilitiesPublicSnapshot): string {
  const lines = [
    'UTILITIES PUBLIC FEED (free APIs — do not invent rates beyond reference + scraped markdown):',
    `postcode: ${snapshot.postcode} | outcode: ${snapshot.outcode}`,
  ]
  if (snapshot.home_power) {
    lines.push(`home_power (profile): ${snapshot.home_power} → energy_type: ${snapshot.energy_type}`)
    lines.push(
      'Do not ask what powers the home — profile already captured power type. Focus tariff, supplier switch, spend band.'
    )
  }
  if (snapshot.council) lines.push(`council: ${snapshot.council}`)
  if (snapshot.region) lines.push(`region: ${snapshot.region}`)
  if (snapshot.localCarbonGPerKwh != null) {
    lines.push(
      `regional_grid_g_per_kwh: ${Math.round(snapshot.localCarbonGPerKwh)} (${snapshot.gridSource})`
    )
  }
  lines.push(
    `reference_april_2026_cap_gbp: ${snapshot.referenceCapGbp}`,
    `reference_elec_p_per_kwh: ${snapshot.referenceElecPPerKwh}`,
    `reference_gas_p_per_kwh: ${snapshot.referenceGasPPerKwh}`,
    `price_cap_citation: ${snapshot.priceCapSourceUrl}`
  )
  if (snapshot.agilePPerKwh != null) {
    lines.push(`indicative_agile_p_per_kwh_inc_vat: ${snapshot.agilePPerKwh.toFixed(2)} (octopus.energy public API)`)
  }
  if (snapshot.ukInfrastructure) {
    lines.push('', formatUkInfrastructureFeedBlock(snapshot.ukInfrastructure))
  }
  if (snapshot.octopusMarket) {
    lines.push('', formatOctopusMarketBlock(snapshot.octopusMarket))
  }
  return lines.join('\n')
}

export { PUBLIC_UK_API_CATALOG, publicApiBundleForJourney } from '@/lib/data/publicUkApisUsage'

export {
  getLiveCarbonIntensity,
  getGenerationMix,
  getLatestWaterReadings,
  getAirQualityData,
  fetchUkInfrastructureFeed,
  formatUkInfrastructureFeedBlock,
} from '@/lib/data/ukPublicInfrastructureApis'

export {
  getActiveEnergyProducts,
  getLiveTariffHalfHourlyRates,
  fetchOctopusMarketSnapshot,
} from '@/lib/data/octopusPublicApis'
