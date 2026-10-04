/**
 * First result for the entry flow: ONE real figure from postcode-only data.
 * Mechanical truth: every value here comes from a live source call (EPC register, Octopus public
 * tariff API). If no source returns a value we return null and the UI shows the action with no
 * figure. Nothing in this file estimates, defaults or invents a number.
 */

import { fetchOpendataEpcProfile } from '@/lib/intelligence/openEpcClient'
import { getActiveEnergyProducts } from '@/lib/data/octopusPublicApis'
import { resolveOctopusRegionLetter } from '@/lib/data/octopusRegion'

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
}

const OCTO_TIMEOUT_MS = 8000

async function regionalElectricityUnitRate(postcode: string): Promise<{ p: number; region: string; product: string } | null> {
  try {
    const { results } = await getActiveEnergyProducts()
    const product = results.find((p) => p.code.startsWith('VAR-') && p.direction.toUpperCase() === 'IMPORT')
    if (!product) return null
    const region = resolveOctopusRegionLetter(postcode)
    const url = `https://api.octopus.energy/v1/products/${product.code}/electricity-tariffs/E-1R-${product.code}-${region}/standard-unit-rates/?page_size=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(OCTO_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { results?: Array<{ value_inc_vat?: number }> }
    const v = json.results?.[0]?.value_inc_vat
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
    return { p: v, region, product: product.code }
  } catch {
    return null
  }
}

export async function resolveFirstResult(postcode: string): Promise<FirstResult | null> {
  const epc = await fetchOpendataEpcProfile(postcode).catch(() => null)
  const band = epc?.found ? epc.currentEnergyRating?.trim().toUpperCase() : undefined
  if (band && /^[A-G]$/.test(band)) {
    const filed = epc?.lodgementDate ? ` (lodged ${epc.lodgementDate.slice(0, 7)})` : ''
    return {
      kind: 'epc_band',
      label: 'Latest energy rating on your postcode',
      value: band,
      detail: `The most recent EPC on the register for ${postcode} is band ${band}${filed}. It is the most recent certificate on your postcode, not necessarily your own home.`,
      source: 'EPC register',
    }
  }

  const rate = await regionalElectricityUnitRate(postcode)
  if (rate) {
    return {
      kind: 'regional_unit_rate',
      label: 'Electricity in your region right now',
      value: `${(Math.round(rate.p * 10) / 10).toFixed(1)}p`,
      unit: 'per kWh',
      detail: `The current standard unit rate for your region (${rate.region}) on Octopus's variable tariff, including VAT.`,
      source: 'Octopus Energy public tariff API',
    }
  }

  return null
}
