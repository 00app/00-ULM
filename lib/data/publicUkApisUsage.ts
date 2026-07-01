/**
 * How each zero-auth UK API is used in 00-00 — lane lock + consumer map.
 * Browser never calls these hosts; server paths below only.
 */

import type { JourneyId } from '@/lib/journeys'

export type PublicApiUsefulness = 'high' | 'medium' | 'low'

export type PublicUkApiEntry = {
  id: string
  endpoint: string
  usefulness: PublicApiUsefulness
  /** Primary journey tiles (lane lock). */
  journeys: JourneyId[]
  /** Server modules / routes that consume this feed. */
  consumers: string[]
  /** What calculations or copy it supports. */
  role: string
  /** When to skip or treat as ambient only. */
  caveats: string
}

export const PUBLIC_UK_API_CATALOG: readonly PublicUkApiEntry[] = [
  {
    id: 'carbon-intensity-live',
    endpoint: 'https://api.carbonintensity.org.uk/intensity',
    usefulness: 'high',
    journeys: ['utilities', 'carbon', 'home'],
    consumers: [
      'lib/data/ukPublicInfrastructureApis.ts',
      'lib/intelligence/nesoGridClient.ts',
      'lib/local/getLocalData.ts',
      'lib/logic/pulse.ts',
      'app/api/pulse/living',
    ],
    role: 'Live national gCO₂/kWh — scales electric heat / EV carbon copy and grid tier.',
    caveats: 'Use actual then forecast; never invent intensity.',
  },
  {
    id: 'carbon-intensity-generation',
    endpoint: 'https://api.carbonintensity.org.uk/generation',
    usefulness: 'high',
    journeys: ['utilities', 'carbon', 'solar'],
    consumers: ['lib/data/ukPublicInfrastructureApis.ts', 'utilities_public_feed → Gemini prefix'],
    role: 'Renewables % in grid — explains why intensity is low/high; solar export context.',
    caveats: 'National mix, not postcode-specific generation.',
  },
  {
    id: 'ea-flood-readings',
    endpoint: 'https://environment.data.gov.uk/flood-monitoring/data/readings',
    usefulness: 'medium',
    journeys: ['water'],
    consumers: ['lib/data/ukPublicInfrastructureApis.ts'],
    role: 'Ambient hydrology sample — drought/flood stress signal for water journey prose.',
    caveats: 'Not household water bill £; do not present as tariff savings.',
  },
  {
    id: 'octopus-products',
    endpoint: 'https://api.octopus.energy/v1/products/',
    usefulness: 'medium',
    journeys: ['utilities', 'money'],
    consumers: ['lib/data/octopusPublicApis.ts', 'fetchUtilitiesPublicSnapshot'],
    role: 'Catalogue of active variable consumer products — tariff-type baseline for JIT scrape.',
    caveats: 'One supplier matrix only; cite as indicative; switching still needs scraped offers.',
  },
  {
    id: 'octopus-agile-rates',
    endpoint: 'https://api.octopus.energy/v1/products/…/standard-unit-rates/',
    usefulness: 'high',
    journeys: ['utilities'],
    consumers: ['lib/data/octopusPublicApis.ts', 'lib/logic/pulse.ts', 'utilities_public_feed'],
    role: 'Half-hourly p/kWh bands for electric / mixed homes — time-shift behaviour copy.',
    caveats: 'Agile product code rotates; fallback URLs in octopusPublicApis; not user-specific tariff.',
  },
  {
    id: 'air-quality-eaqi',
    endpoint: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    usefulness: 'low',
    journeys: ['carbon', 'travel'],
    consumers: ['lib/data/ukPublicInfrastructureApis.ts'],
    role: 'European AQI at postcode when Defra legacy JSON 404s — optional carbon/travel context.',
    caveats:
      'Defra assets/json/current-aqi-regional.json is retired; not energy £; use SOS for station-level Defra if needed later.',
  },
  {
    id: 'postcodes-io',
    endpoint: 'https://api.postcodes.io',
    usefulness: 'high',
    journeys: ['home', 'utilities', 'grants'],
    consumers: ['lib/local/getLocalData.ts', 'app/api/local-intelligence'],
    role: 'Council / region / outcode — anchors all localized scrape queries.',
    caveats: 'UK postcodes only.',
  },
  {
    id: 'ofgem-cap-html',
    endpoint: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
    usefulness: 'high',
    journeys: ['utilities', 'home', 'money'],
    consumers: ['lib/logic/pulse.ts', 'lib/brains/constants', 'Firecrawl + Gemini extraction'],
    role: 'Canonical £ cap + unit-rate citations for mechanical truth.',
    caveats: 'HTML scrape — use constants fallback if parse fails.',
  },
  {
    id: 'climatiq-carbon',
    endpoint: 'https://api.climatiq.io/data/v1/estimate',
    usefulness: 'high',
    journeys: ['carbon', 'travel', 'utilities', 'home'],
    consumers: ['lib/intelligence/climatiqClient.ts'],
    role: 'Activity-based kg CO₂e for electricity, gas, car, rail, flights (GB region, DESNZ factors). Requires CLIMATIQ_API_KEY (free 10k/month).',
    caveats: 'Skips gracefully when key unset; use DESNZ hardcoded factors as mechanical fallback.',
  },
  {
    id: 'open-food-facts',
    endpoint: 'https://world.openfoodfacts.org/api/v2/product',
    usefulness: 'medium',
    journeys: ['food', 'shopping', 'carbon'],
    consumers: ['lib/intelligence/openFoodFactsClient.ts'],
    role: 'Eco-score grade A–E, kg CO₂/kg product (Agribalyse LCA), packaging materials — per barcode or search query.',
    caveats: 'Coverage best for packaged goods with EAN barcodes; fresh produce patchy.',
  },
  {
    id: 'bank-of-england-base-rate',
    endpoint: 'https://www.bankofengland.co.uk/boeapps/database',
    usefulness: 'medium',
    journeys: ['money'],
    consumers: ['lib/intelligence/bankOfEnglandClient.ts'],
    role: 'Current BoE Bank Rate — "is your savings account beating base rate?" signal for money zone.',
    caveats: 'CSV scrape; falls back to hardcoded rate when fetch fails. Rate changes infrequently.',
  },
  {
    id: 'pvgis-solar',
    endpoint: 'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc',
    usefulness: 'high',
    journeys: ['solar', 'home', 'carbon'],
    consumers: ['lib/intelligence/pvgisClient.ts', 'lib/intelligence/solarIrradianceClient.ts'],
    role: 'Annual solar yield kWh + irradiance kWh/m² by lat/lon (from postcode geocode). Free EU Commission API.',
    caveats: 'Requires lat/lon from postcodes.io; 14s timeout; 4kWp system assumed.',
  },
  {
    id: 'epc-register',
    endpoint: 'https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search',
    usefulness: 'high',
    journeys: ['home', 'grants', 'solar', 'utilities'],
    consumers: ['lib/intelligence/openEpcClient.ts'],
    role: 'EPC band A–G, heating costs, wall/roof/floor construction, main fuel, floor area — per postcode + house number. Requires OPENEPC_BEARER_TOKEN (free).',
    caveats: 'Migrated from epc.opendatacommunities.org (shut down May 2026). Two-step: search → full certificate.',
  },
  {
    id: 'land-registry-ppd',
    endpoint: 'https://landregistry.data.gov.uk/landregistry/query',
    usefulness: 'medium',
    journeys: ['home', 'money'],
    consumers: ['lib/intelligence/landRegistryClient.ts'],
    role: 'Last sale price, property type (detached/semi/flat), tenure — for home value context and money zone equity signals.',
    caveats: 'England & Wales only. SPARQL endpoint; postcode-level, not current valuation.',
  },
] as const

/** APIs to load for a given journey JIT scrape (keeps Vercel fast). */
export function publicApiBundleForJourney(journeyKey: JourneyId, homePower?: string): {
  infrastructure: boolean
  octopusMarket: boolean
} {
  const hp = String(homePower ?? '').toUpperCase()
  const electric = hp === 'ELECTRIC' || hp === 'MIX'
  switch (journeyKey) {
    case 'utilities':
      return { infrastructure: true, octopusMarket: true }
    case 'carbon':
      return { infrastructure: true, octopusMarket: false }
    case 'water':
      return { infrastructure: true, octopusMarket: false }
    case 'solar':
      return { infrastructure: true, octopusMarket: electric }
    default:
      return { infrastructure: journeyKey === 'home', octopusMarket: false }
  }
}
