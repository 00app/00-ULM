/**
 * First result for the entry flow: the place played back, then up to four real insights from
 * postcode-only data, one per major category (energy, carbon, solar, home), each as one short
 * sentence the screen shows one at a time.
 * Mechanical truth: every value here comes from a live source call (Octopus public tariff API,
 * Carbon Intensity API, EU PVGIS, EPC register, HM Land Registry). An insight whose source
 * fails is left out, never estimated; if none come back we return null and the UI shows the
 * action with no figures. Nothing in this file estimates, defaults or invents a number.
 */

import { fetchOpendataEpcProfile } from '@/lib/intelligence/openEpcClient'
import { fetchLandRegistryByPostcode } from '@/lib/intelligence/landRegistryClient'
import { fetchPostcodeGeo, type PostcodeGeoSnapshot } from '@/lib/intelligence/postcodeGeoClient'
import { getActiveEnergyProducts } from '@/lib/data/octopusPublicApis'
import { resolveOctopusRegionLetter } from '@/lib/data/octopusRegion'

export type FirstResultCategory = 'energy' | 'carbon' | 'solar' | 'home'

export type FirstResultInsight = {
  category: FirstResultCategory
  /** One short sentence (shown at H2 size, one at a time) carrying the live figure. */
  sentence: string
  /** Where the figure came from (shown under the sentence). */
  source: string
}

export type FirstResult = {
  /** Town or district for the postcode, played back to the user ("Manchester"). */
  place: string | null
  /** In display order; only categories whose live source returned data. */
  insights: FirstResultInsight[]
}

const OCTO_TIMEOUT_MS = 8000
const SOURCE_CAP_MS = 12_000

function withCap<T>(p: Promise<T>, ms = SOURCE_CAP_MS): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

function formatPence(p: number): string {
  return `${(Math.round(p * 10) / 10).toFixed(1)}p`
}

function formatGbpShort(n: number): string {
  if (n >= 1_000_000) return `£${(Math.round(n / 100_000) / 10).toString()}m`
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`
  return `£${Math.round(n)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonthYear(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${m[1]}` : ''
}

// ── Energy: Octopus variable tariff unit rates for the region ──────────────────────────────

async function fetchOctopusRate(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(OCTO_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { results?: Array<{ value_inc_vat?: number }> }
    const v = json.results?.[0]?.value_inc_vat
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

async function energyInsight(postcode: string): Promise<FirstResultInsight | null> {
  const { results } = await getActiveEnergyProducts()
  const product = results.find((p) => p.code.startsWith('VAR-') && p.direction.toUpperCase() === 'IMPORT')
  if (!product) return null
  const region = resolveOctopusRegionLetter(postcode)
  const base = `https://api.octopus.energy/v1/products/${product.code}`
  const [elecP, gasP] = await Promise.all([
    fetchOctopusRate(`${base}/electricity-tariffs/E-1R-${product.code}-${region}/standard-unit-rates/?page_size=1`),
    fetchOctopusRate(`${base}/gas-tariffs/G-1R-${product.code}-${region}/standard-unit-rates/?page_size=1`),
  ])
  if (elecP == null) return null
  const gas = gasP != null ? `, gas ${formatPence(gasP)}` : ''
  return {
    category: 'energy',
    sentence: `Electricity here costs ${formatPence(elecP)} a unit${gas}.`,
    source: 'Octopus Energy tariff API, standard variable, inc VAT',
  }
}

// ── Carbon: live regional grid intensity + generation mix ─────────────────────────────────

async function carbonInsight(postcode: string): Promise<FirstResultInsight | null> {
  const outcode = postcode.replace(/\s+/g, '').toUpperCase().slice(0, -3)
  if (!outcode) return null
  const res = await fetch(`https://api.carbonintensity.org.uk/regional/postcode/${encodeURIComponent(outcode)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(OCTO_TIMEOUT_MS),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: Array<{
      shortname?: string
      data?: Array<{ intensity?: { forecast?: number }; generationmix?: Array<{ fuel: string; perc: number }> }>
    }>
  }
  const region = json.data?.[0]
  const slot = region?.data?.[0]
  const g = slot?.intensity?.forecast
  // 0 is a real reading (e.g. South Scotland on a windy day), so only reject missing/negative.
  if (typeof g !== 'number' || !Number.isFinite(g) || g < 0) return null
  const grams = Math.round(g)
  return {
    category: 'carbon',
    sentence:
      grams === 0
        ? 'Your grid is running carbon free right now.'
        : `Every unit you use right now puts out ${grams}g of CO₂.`,
    source: `Carbon Intensity API (NESO)${region?.shortname ? `, ${region.shortname}` : ''}`,
  }
}

// ── Solar: PVGIS yield per kW of panels at the best angle for this spot ───────────────────

async function solarInsight(geo: PostcodeGeoSnapshot | null): Promise<FirstResultInsight | null> {
  if (!geo?.found || geo.lat == null || geo.lon == null) return null
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${geo.lat}&lon=${geo.lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(SOURCE_CAP_MS) })
  if (!res.ok) return null
  const json = (await res.json()) as { outputs?: { totals?: { fixed?: { E_y?: number } } } }
  const kwh = json.outputs?.totals?.fixed?.E_y
  if (typeof kwh !== 'number' || !Number.isFinite(kwh) || kwh <= 0) return null
  return {
    category: 'solar',
    sentence: `A kW of solar panels here makes ${Math.round(kwh).toLocaleString('en-GB')} units a year.`,
    source: 'EU PVGIS, best angle, typical losses',
  }
}

// ── Home: latest EPC band on the postcode, else the latest recorded sale ──────────────────

async function homeInsight(postcode: string): Promise<FirstResultInsight | null> {
  const [epc, sale] = await Promise.all([
    withCap(fetchOpendataEpcProfile(postcode)),
    withCap(fetchLandRegistryByPostcode(postcode)),
  ])
  const band = epc?.found ? epc.currentEnergyRating?.trim().toUpperCase() : undefined
  if (band && /^[A-G]$/.test(band)) {
    const when = formatMonthYear(epc?.lodgementDate)
    const leaky = band >= 'D' ? ', so heat and money leak out' : ''
    return {
      category: 'home',
      sentence: `The last home rated on your street scored ${band}${leaky}.`,
      source: `EPC register${when ? `, ${when}` : ''}, latest certificate on the postcode`,
    }
  }
  if (sale?.found && typeof sale.lastSalePrice === 'number' && sale.lastSalePrice > 0) {
    const when = formatMonthYear(sale.lastSaleDate)
    const type =
      sale.propertyType === 'FLAT'
        ? 'a flat'
        : sale.propertyType === 'TERRACED'
          ? 'a terraced house'
          : sale.propertyType === 'SEMI'
            ? 'a semi-detached house'
            : sale.propertyType === 'DETACHED'
              ? 'a detached house'
              : 'a home'
    return {
      category: 'home',
      sentence: `The last home sold on your street went for ${formatGbpShort(sale.lastSalePrice)}.`,
      source: `HM Land Registry, ${type}${when ? `, ${when}` : ''}`,
    }
  }
  return null
}

function placeName(geo: PostcodeGeoSnapshot | null): string | null {
  const name = (geo?.parish?.trim() || geo?.adminDistrict?.trim() || '')
    .replace(/^(City|County|Royal Borough|London Borough) of /i, '')
    .replace(/, City of$/i, '')
    .trim()
  return name || null
}

export async function resolveFirstResult(postcode: string): Promise<FirstResult | null> {
  const geoPromise = withCap(fetchPostcodeGeo(postcode))
  const [geo, ...insights] = await Promise.all([
    geoPromise,
    withCap(energyInsight(postcode)),
    withCap(carbonInsight(postcode)),
    withCap(geoPromise.then((g) => solarInsight(g))),
    withCap(homeInsight(postcode), SOURCE_CAP_MS + 1_000),
  ])
  const found = insights.filter((i): i is FirstResultInsight => i != null)
  return found.length > 0 ? { place: placeName(geo), insights: found } : null
}
