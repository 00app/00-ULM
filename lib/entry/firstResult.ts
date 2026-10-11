/**
 * First result for the entry flow: real figures from postcode-only data.
 * Mechanical truth: every value here comes from a live source call (EPC register, Octopus public
 * tariff API). If no source returns a value we return null and the UI shows the action with no
 * figure. Nothing in this file estimates, defaults or invents a number.
 */

import { fetchOpendataEpcProfile } from '@/lib/intelligence/openEpcClient'
import { getActiveEnergyProducts } from '@/lib/data/octopusPublicApis'
import { resolveOctopusRegionLetter } from '@/lib/data/octopusRegion'

/** A secondary live figure shown alongside the headline one — never padded or estimated. */
export type FirstResultFigure = {
  label: string
  value: string
  unit?: string
}

export type FirstResult = {
  kind: 'epc_band' | 'regional_unit_rate'
  /** Short caption above the figure. */
  label: string
  /** The figure as shown, e.g. "D" or "27.4p". */
  value: string
  /** Unit suffix shown small, e.g. "per kWh". */
  unit?: string
  /** One plain sentence saying exactly what the figure is. */
  detail: string
  /** Where the figure came from (shown on screen). */
  source: string
  /** Additional real, verified figures from whichever live sources returned data. Empty when
   *  nothing else came back — the screen never pads this out with an estimate. */
  extras: FirstResultFigure[]
}

const OCTO_TIMEOUT_MS = 8000

type DualFuelRates = { elecP: number; gasP: number | null; region: string; product: string }

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

/** Live electricity unit rate (required) plus gas unit rate (bonus — omitted, not estimated, if
 *  the tariff has no gas leg for this region or the call fails). */
async function regionalDualFuelRates(postcode: string): Promise<DualFuelRates | null> {
  try {
    const { results } = await getActiveEnergyProducts()
    const product = results.find((p) => p.code.startsWith('VAR-') && p.direction.toUpperCase() === 'IMPORT')
    if (!product) return null
    const region = resolveOctopusRegionLetter(postcode)

    const elecP = await fetchOctopusRate(
      `https://api.octopus.energy/v1/products/${product.code}/electricity-tariffs/E-1R-${product.code}-${region}/standard-unit-rates/?page_size=1`
    )
    if (elecP == null) return null

    const gasP = await fetchOctopusRate(
      `https://api.octopus.energy/v1/products/${product.code}/gas-tariffs/G-1R-${product.code}-${region}/standard-unit-rates/?page_size=1`
    )

    return { elecP, gasP, region, product: product.code }
  } catch {
    return null
  }
}

function formatPence(p: number): string {
  return `${(Math.round(p * 10) / 10).toFixed(1)}p`
}

export async function resolveFirstResult(postcode: string): Promise<FirstResult | null> {
  const [epc, rates] = await Promise.all([
    fetchOpendataEpcProfile(postcode).catch(() => null),
    regionalDualFuelRates(postcode),
  ])

  const band = epc?.found ? epc.currentEnergyRating?.trim().toUpperCase() : undefined
  if (band && /^[A-G]$/.test(band)) {
    const filed = epc?.lodgementDate ? ` (lodged ${epc.lodgementDate.slice(0, 7)})` : ''
    const extras: FirstResultFigure[] = []
    if (rates) {
      extras.push({ label: 'Electricity in your region', value: formatPence(rates.elecP), unit: 'per kWh' })
      if (rates.gasP != null) {
        extras.push({ label: 'Gas in your region', value: formatPence(rates.gasP), unit: 'per kWh' })
      }
    }
    return {
      kind: 'epc_band',
      label: 'Latest energy rating on your postcode',
      value: band,
      detail: `The most recent EPC on the register for ${postcode} is band ${band}${filed}. It is the most recent certificate on your postcode, not necessarily your own home.`,
      source: 'EPC register',
      extras,
    }
  }

  if (rates) {
    const extras: FirstResultFigure[] = []
    if (rates.gasP != null) {
      extras.push({ label: 'Gas in your region right now', value: formatPence(rates.gasP), unit: 'per kWh' })
    }
    return {
      kind: 'regional_unit_rate',
      label: 'Electricity in your region right now',
      value: formatPence(rates.elecP),
      unit: 'per kWh',
      detail: `The current standard unit rate for your region (${rates.region}) on Octopus's variable tariff, including VAT.`,
      source: 'Octopus Energy public tariff API',
      extras,
    }
  }

  return null
}
