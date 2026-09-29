/**
 * Octopus Energy public API — no keys (product catalogue + half-hourly unit rates).
 * Server-side only; not a switch recommendation.
 */

import { resolveOctopusRegionLetter } from '@/lib/data/octopusRegion'

const JSON_HEADERS = { Accept: 'application/json' } as const
const TIMEOUT_MS = 10000

export type OctopusProductSummary = {
  code: string
  full_name: string
  direction: string
  is_variable?: boolean
  is_green?: boolean
}

export type OctopusHalfHourlyRate = {
  valid_from: string
  valid_to: string
  value_inc_vat: number
}

/**
 * Agile tariff product codes to try (newest first — 404 falls through). AGILE-18-02-21 is
 * closed to new customers but its rate-feed endpoint is still actively updated by Octopus as a
 * long-standing reference series, so it stays useful here as a live indicative rate even though
 * it's not a real signup option. AGILE-FLEX-22-11-25 (closed 2023-12-11, feed no longer updated)
 * was previously listed ahead of it and always 404'd first — removed.
 * Both product+region URLs are built per-request in getAgileUnitRateUrls(), not hardcoded to a
 * single region, since the region letter must match the caller's actual postcode.
 */
const AGILE_PRODUCT_CODES = ['AGILE-18-02-21'] as const

function getAgileUnitRateUrls(postcode?: string | null): string[] {
  const region = resolveOctopusRegionLetter(postcode)
  return AGILE_PRODUCT_CODES.map(
    (product) =>
      `https://api.octopus.energy/v1/products/${product}/electricity-tariffs/E-1R-${product}-${region}/standard-unit-rates/`
  )
}

async function fetchJson<T>(url: string, pageSize?: number): Promise<T | null> {
  try {
    const sep = url.includes('?') ? '&' : '?'
    const full =
      pageSize != null ? `${url}${sep}page_size=${pageSize}` : url
    const res = await fetch(full, {
      headers: JSON_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Active consumer variable products (IMPORT / EXPORT matrix). */
export async function getActiveEnergyProducts(): Promise<{
  count: number
  results: OctopusProductSummary[]
}> {
  const json = await fetchJson<{
    count?: number
    results?: Array<{
      code?: string
      full_name?: string
      direction?: string
      is_variable?: boolean
      is_green?: boolean
    }>
  }>(
    'https://api.octopus.energy/v1/products/?is_variable=true&is_business=false'
  )
  const results = (json?.results ?? [])
    .map((p) => ({
      code: String(p.code ?? '').trim(),
      full_name: String(p.full_name ?? '').trim(),
      direction: String(p.direction ?? '').trim(),
      is_variable: p.is_variable,
      is_green: p.is_green,
    }))
    .filter((p) => p.code.length > 0)
  return { count: json?.count ?? results.length, results }
}

/** Upcoming half-hourly unit rates (p/kWh inc VAT) — tries current Agile product codes for the
 *  caller's region (falls back to London/C when no postcode is given). */
export async function getLiveTariffHalfHourlyRates(
  maxSlots = 12,
  postcode?: string | null
): Promise<{ productUrl: string; results: OctopusHalfHourlyRate[] } | null> {
  const cap = Math.min(48, Math.max(1, maxSlots))
  for (const baseUrl of getAgileUnitRateUrls(postcode)) {
    const json = await fetchJson<{
      results?: Array<{
        valid_from?: string
        valid_to?: string
        value_inc_vat?: number
      }>
    }>(baseUrl, cap)
    const results = (json?.results ?? [])
      .map((slot) => ({
        valid_from: String(slot.valid_from ?? ''),
        valid_to: String(slot.valid_to ?? ''),
        value_inc_vat:
          typeof slot.value_inc_vat === 'number' && Number.isFinite(slot.value_inc_vat)
            ? slot.value_inc_vat
            : 0,
      }))
      .filter((s) => s.valid_from && s.value_inc_vat > 0)
    if (results.length) return { productUrl: baseUrl, results }
  }
  return null
}

/** Single indicative p/kWh from the next available half-hour slot, for the caller's region. */
export async function getIndicativeAgilePPerKwh(postcode?: string | null): Promise<number | null> {
  const live = await getLiveTariffHalfHourlyRates(1, postcode)
  const v = live?.results?.[0]?.value_inc_vat
  return typeof v === 'number' && v > 0 ? v : null
}

export type OctopusMarketSnapshot = {
  productCount: number
  productsSample: OctopusProductSummary[]
  agile?: {
    productUrl: string
    slots: OctopusHalfHourlyRate[]
    minPPerKwh: number
    maxPPerKwh: number
  }
  fetchedAt: string
}

export async function fetchOctopusMarketSnapshot(opts?: {
  includeAgileSlots?: boolean
  productSample?: number
  postcode?: string | null
}): Promise<OctopusMarketSnapshot | null> {
  const sampleN = Math.min(8, Math.max(1, opts?.productSample ?? 5))
  const products = await getActiveEnergyProducts()
  if (!products.results.length && products.count === 0) return null

  const snapshot: OctopusMarketSnapshot = {
    productCount: products.count,
    productsSample: products.results.slice(0, sampleN),
    fetchedAt: new Date().toISOString(),
  }

  if (opts?.includeAgileSlots !== false) {
    const agile = await getLiveTariffHalfHourlyRates(12, opts?.postcode)
    if (agile?.results.length) {
      const vals = agile.results.map((r) => r.value_inc_vat)
      snapshot.agile = {
        productUrl: agile.productUrl,
        slots: agile.results,
        minPPerKwh: Math.min(...vals),
        maxPPerKwh: Math.max(...vals),
      }
    }
  }

  return snapshot
}

export function formatOctopusMarketBlock(snap: OctopusMarketSnapshot): string {
  const lines = [
    `octopus_active_consumer_products: ${snap.productCount}`,
    ...snap.productsSample.map(
      (p) => `  - ${p.code}: ${p.full_name} (${p.direction})`
    ),
  ]
  if (snap.agile?.slots.length) {
    lines.push(
      `octopus_agile_half_hourly_sample: ${snap.agile.slots.length} slots (${snap.agile.minPPerKwh.toFixed(2)}–${snap.agile.maxPPerKwh.toFixed(2)} p/kWh inc VAT)`
    )
    const next = snap.agile.slots[0]
    lines.push(`  next_slot: ${next.valid_from} → ${next.valid_to} @ ${next.value_inc_vat} p/kWh`)
  }
  return lines.join('\n')
}
