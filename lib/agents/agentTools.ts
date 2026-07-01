/**
 * Tool declarations and executors for the ZeroAgent.
 * Each tool maps to a free UK data API — no Firecrawl, no paid keys required.
 * Gemini selects which tools to call based on the category and profile context.
 */

import type { FunctionDeclaration } from '@google/generative-ai'
import { SchemaType } from '@google/generative-ai'

// ─── Tool declarations (Gemini schema) ───────────────────────────────────────

export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'fetch_epc_data',
    description:
      'Fetch the EPC (Energy Performance Certificate) for a UK property. Returns current/potential energy rating, CO₂ emissions, floor area, heating type, and glazing. Use for home, utilities, grants, solar, tech, carbon categories.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode (e.g. BN17 5TL)' },
        house_number: {
          type: SchemaType.STRING,
          description: 'House number or name for address-matched lookup (optional)',
        },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_solar_estimate',
    description:
      'Fetch solar PV yield estimate for a UK postcode using PVGIS. Returns estimated annual kWh and yield factor. Use for solar, carbon, tech categories, or when user has south-facing roof.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_grid_intensity',
    description:
      'Fetch live UK grid carbon intensity from NESO. Returns gCO₂/kWh, renewable generation mix (wind, solar, gas etc). Use for carbon, home, utilities, solar categories.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode for regional intensity' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_flood_risk',
    description:
      'Fetch flood risk classification for a UK postcode. Returns LOW/MEDIUM/HIGH/VERY_HIGH zone. Use for home, water, holidays, grants categories or coastal/river postcodes.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_deprivation_index',
    description:
      'Fetch ONS Index of Multiple Deprivation decile (1=most deprived, 10=least). Use for grants, food, money, shopping, waste categories — higher deprivation areas qualify for more means-tested grants.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_dno_region',
    description:
      'Fetch the Distribution Network Operator region for a UK postcode. Returns DNO name and region. Use for solar, tech, utilities, grants categories — DNO affects smart meter rollout and export tariff availability.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_land_registry',
    description:
      'Fetch Land Registry property value and tenure data for a UK postcode. Returns last sold price, property type, and tenure (freehold/leasehold). Use for home, grants, solar, money, shopping categories.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
        house_number: {
          type: SchemaType.STRING,
          description: 'House number for address-specific lookup (optional)',
        },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'fetch_postcode_geo',
    description:
      'Fetch postcode geolocation (lat/lon), local authority, region, and constituency from Postcodes.io. Always useful as a first call to ground the research in a real place.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        postcode: { type: SchemaType.STRING, description: 'UK postcode' },
      },
      required: ['postcode'],
    },
  },
  {
    name: 'scrape_url',
    description:
      'Fetch and extract plain text from a UK web page (gov.uk, Ofgem, Energy Saving Trust, etc). Use to get live policy details, grant amounts, or tariff rates. Only use trusted UK domains. Max 1 URL per call.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
          description:
            'Full https:// URL to scrape. Must be a trusted UK domain (gov.uk, ofgem.gov.uk, energysavingtrust.org.uk, lovefoodhatewaste.com, waterwise.org.uk, recyclenow.com, etc).',
        },
      },
      required: ['url'],
    },
  },
]

// ─── Tool executors ───────────────────────────────────────────────────────────

type ToolResult = Record<string, unknown>

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const postcode = typeof args.postcode === 'string' ? args.postcode.trim().toUpperCase() : ''
  const houseNumber = typeof args.house_number === 'string' ? args.house_number : undefined

  try {
    switch (name) {
      case 'fetch_postcode_geo': {
        const { fetchPostcodeGeo } = await import('@/lib/intelligence/postcodeGeoClient')
        const geo = await fetchPostcodeGeo(postcode)
        if (!geo.found) return { found: false, note: 'Postcode not recognised' }
        return {
          found: true,
          postcode,
          latitude: geo.lat,
          longitude: geo.lon,
          local_authority: geo.adminDistrict,
          constituency: geo.parliamentaryConstituency,
        }
      }

      case 'fetch_epc_data': {
        const { fetchOpendataEpcProfile } = await import('@/lib/intelligence/openEpcClient')
        const epc = await fetchOpendataEpcProfile(postcode, { houseNumber })
        if (!epc.found) return { found: false, note: 'No EPC found for this address' }
        return {
          found: true,
          current_rating: epc.currentEnergyRating,
          potential_rating: epc.potentialEnergyRating,
          current_energy_score: epc.currentEnergyEfficiencyScore,
          potential_energy_score: epc.potentialEnergyEfficiencyScore,
          floor_area_sqm: epc.totalFloorArea,
          main_fuel: epc.mainFuel,
          property_type: epc.propertyType,
          construction_age: epc.constructionAgeBand,
          walls: epc.wallsDescription,
          roof: epc.roofDescription,
          address_matched: epc.addressMatched,
          lodgement_date: epc.lodgementDate,
          is_stale: epc.isStale,
        }
      }

      case 'fetch_solar_estimate': {
        const { fetchPostcodeGeo } = await import('@/lib/intelligence/postcodeGeoClient')
        const { fetchPvgisSolarEstimate } = await import('@/lib/intelligence/pvgisClient')
        const geo = await fetchPostcodeGeo(postcode)
        const solar = await fetchPvgisSolarEstimate({
          postcode,
          lat: geo.lat,
          lon: geo.lon,
        })
        if (!solar.found) return { found: false, note: 'Could not estimate solar yield' }
        return {
          found: true,
          annual_kwh_estimate: solar.annualKwhEstimate,
          yield_factor: solar.yieldFactor,
          note: `A 4 kWp system at ${postcode} would generate approx ${solar.annualKwhEstimate} kWh/year`,
        }
      }

      case 'fetch_grid_intensity': {
        const { fetchNesoGridIntensity } = await import('@/lib/intelligence/nesoGridClient')
        const grid = await fetchNesoGridIntensity(postcode)
        if (!grid) return { found: false, note: 'Grid intensity unavailable' }
        return {
          found: true,
          g_co2_per_kwh: grid.intensityG,
          tier: grid.tier,
          source: grid.source,
          solar_pct: grid.generationMix?.solarPercentage,
          wind_pct: grid.generationMix?.windPercentage,
        }
      }

      case 'fetch_flood_risk': {
        const { fetchFloodRiskByPostcode } = await import('@/lib/intelligence/floodRiskClient')
        const flood = await fetchFloodRiskByPostcode(postcode)
        return {
          found: flood.found,
          zone: flood.floodRiskZone ?? 'UNKNOWN',
          note: flood.found
            ? `Flood risk for ${postcode}: ${flood.floodRiskZone}`
            : 'No flood risk data found',
        }
      }

      case 'fetch_deprivation_index': {
        const { fetchDeprivationByPostcode } = await import('@/lib/intelligence/deprivationClient')
        const dep = await fetchDeprivationByPostcode(postcode)
        return {
          found: dep.found,
          imd_decile: dep.imdDecile,
          income_deprivation_score: dep.incomeDeprivationScore,
          note: dep.found
            ? `IMD decile ${dep.imdDecile}/10 (1=most deprived). ${dep.imdDecile && dep.imdDecile <= 3 ? 'Deprived area — may qualify for ECO4, WHD, and means-tested grants.' : dep.imdDecile && dep.imdDecile >= 8 ? 'Affluent area — focus on solar, smart tariffs, EV.' : 'Mid-range deprivation — broad eligibility.'}`
            : 'No deprivation data found',
        }
      }

      case 'fetch_dno_region': {
        const { fetchDnoByPostcode } = await import('@/lib/intelligence/dnoClient')
        const dno = await fetchDnoByPostcode(postcode)
        return {
          found: dno.found,
          dno_label: dno.label,
          dno_region: dno.dnoRegion,
          note: dno.found
            ? `DNO: ${dno.label} (${dno.dnoRegion}). Relevant for smart meter rollout and export tariff registration.`
            : 'DNO region unknown',
        }
      }

      case 'fetch_land_registry': {
        const { fetchLandRegistryByPostcode } = await import(
          '@/lib/intelligence/landRegistryClient'
        )
        const lr = await fetchLandRegistryByPostcode(postcode, { houseNumber })
        if (!lr.found) return { found: false, note: 'No Land Registry data found' }
        return {
          found: true,
          last_sale_price: lr.lastSalePrice,
          last_sale_date: lr.lastSaleDate,
          property_type: lr.propertyType,
          tenure: lr.tenure,
          property_value_band: lr.propertyValueBand,
          address_matched: lr.addressMatched,
        }
      }

      case 'scrape_url': {
        const url = typeof args.url === 'string' ? args.url.trim() : ''
        if (!url.startsWith('https://')) {
          return { found: false, note: 'Only https:// URLs are permitted' }
        }
        // Restrict to trusted UK domains — block internal calls and untrusted sources
        const TRUSTED_DOMAINS = [
          'gov.uk', 'ofgem.gov.uk', 'energysavingtrust.org.uk', 'lovefoodhatewaste.com',
          'waterwise.org.uk', 'recyclenow.com', 'wrap.org.uk', 'visitbritain.com',
          'eurostar.com', 'moneysavingexpert.com', 'uswitch.com', 'comparethemarket.com',
          'neso.energy', 'nationalgrideso.com', 'environment-agency.gov.uk',
          'citizensadvice.org.uk', 'moneyhelper.org.uk', 'which.co.uk',
        ]
        let hostname = ''
        try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch { /* invalid */ }
        const isTrusted = TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))
        if (!isTrusted) {
          return { found: false, note: `Domain not in trusted allowlist: ${hostname}` }
        }
        const { fetchMarkdownForUrlsFreeFirst } = await import('@/lib/agents/freeScraper')
        const rows = await fetchMarkdownForUrlsFreeFirst([url], { minChars: 100, maxUrls: 1 })
        if (!rows.length) return { found: false, note: `Could not fetch content from ${url}` }
        return {
          found: true,
          url: rows[0].url,
          title: rows[0].title,
          content: rows[0].markdown.slice(0, 3000),
        }
      }

      default:
        return { error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return { error: `Tool ${name} failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}
