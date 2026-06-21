import type { LocalIntelligence } from '@/lib/local/getLocalData'
import {
  resolveUnifiedGridIntensityGPerKwh,
  syncFallbackGridIntensityGPerKwh,
} from '@/lib/brains/liveGridCarbonFactor'
import { TYPICAL_ANNUAL_CAP } from '@/lib/brains/constants'

export interface LivePulseSnapshot {
  priceCapGbp: number
  electricityPPerKwh: number
  gasPPerKwh: number
  regionalCarbonGPerKwh: number
  agilePPerKwh: number | null
  source: 'live' | 'fallback'
}

const SAFE_SENTINEL = {
  priceCapGbp: TYPICAL_ANNUAL_CAP,
  electricityPPerKwh: 24.67,
  gasPPerKwh: 5.74,
} as const

function compactPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase()
}

async function fetchOfgemPulse(): Promise<{
  priceCapGbp: number
  electricityPPerKwh: number
  gasPPerKwh: number
} | null> {
  try {
    const res = await fetch('https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap', {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const html = await res.text()
    const cap = html.match(/£\s*([0-9]{1,3}(?:,[0-9]{3})?)/)
    const elec = html.match(/([0-9]{1,2}\.[0-9]{1,2})\s*p\/kWh[^<]{0,80}electric/i)
    const gas = html.match(/([0-9]{1,2}\.[0-9]{1,2})\s*p\/kWh[^<]{0,80}gas/i)
    return {
      priceCapGbp: cap ? Number(cap[1].replace(/,/g, '')) : SAFE_SENTINEL.priceCapGbp,
      electricityPPerKwh: elec ? Number(elec[1]) : SAFE_SENTINEL.electricityPPerKwh,
      gasPPerKwh: gas ? Number(gas[1]) : SAFE_SENTINEL.gasPPerKwh,
    }
  } catch {
    return null
  }
}

async function fetchNationalGridPulse(postcode: string): Promise<number | null> {
  const g = await resolveUnifiedGridIntensityGPerKwh(postcode).catch(() => null)
  return typeof g === 'number' && g > 0 ? g : null
}

async function fetchOctopusAgilePulse(regionCode: string): Promise<number | null> {
  try {
    const code = /^[A-Z]$/.test(regionCode) ? regionCode : 'A'
    const url = `https://api.octopus.energy/v1/products/AGILE-18-02-21/electricity-tariffs/E-1R-AGILE-18-02-21-${code}/standard-unit-rates/?page_size=1`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { results?: Array<{ value_inc_vat?: number }> }
    const val = json?.results?.[0]?.value_inc_vat
    return typeof val === 'number' ? val : null
  } catch {
    return null
  }
}

function regionCodeFromPostcode(postcode: string): string {
  const first = compactPostcode(postcode).charAt(0)
  return first && /[A-Z]/.test(first) ? first : 'A'
}

/** Degraded pulse when live scrape fails — always safe to return as HTTP 200. */
export function buildFallbackSnapshot(local: LocalIntelligence | null, postcode?: string): LivePulseSnapshot {
  const regionalCarbonGPerKwh =
    typeof local?.localCarbonG === 'number' && local.localCarbonG > 0
      ? local.localCarbonG
      : syncFallbackGridIntensityGPerKwh(postcode, local)
  return {
    priceCapGbp: SAFE_SENTINEL.priceCapGbp,
    electricityPPerKwh: SAFE_SENTINEL.electricityPPerKwh,
    gasPPerKwh: SAFE_SENTINEL.gasPPerKwh,
    regionalCarbonGPerKwh,
    agilePPerKwh: null,
    source: 'fallback',
  }
}

export async function fetchLivingPulseSnapshot(
  postcode: string,
  local: LocalIntelligence | null
): Promise<LivePulseSnapshot> {
  /** Browser cannot scrape Ofgem / grid APIs (CORS) — proxy via our route. */
  if (typeof window !== 'undefined') {
    try {
      const pc = compactPostcode(postcode)
      if (pc.length >= 4) {
        const res = await fetch(`/api/pulse/living?postcode=${encodeURIComponent(pc)}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          return (await res.json()) as LivePulseSnapshot
        }
      }
    } catch {
      /* fall through */
    }
    console.warn('[pulse] Safe Sentinel fallback active')
    return buildFallbackSnapshot(local, postcode)
  }

  const ofgem = await fetchOfgemPulse()
  const carbon = await fetchNationalGridPulse(postcode)
  const agile = await fetchOctopusAgilePulse(regionCodeFromPostcode(postcode))

  const useFallback = !ofgem || carbon == null
  if (useFallback) {
    console.warn('[pulse] Safe Sentinel fallback active')
    return { ...buildFallbackSnapshot(local, postcode), agilePPerKwh: agile }
  }

  return {
    priceCapGbp: ofgem.priceCapGbp,
    electricityPPerKwh: ofgem.electricityPPerKwh,
    gasPPerKwh: ofgem.gasPPerKwh,
    regionalCarbonGPerKwh:
      carbon ??
      (typeof local?.localCarbonG === 'number' && local.localCarbonG > 0
        ? local.localCarbonG
        : syncFallbackGridIntensityGPerKwh(postcode, local)),
    agilePPerKwh: agile,
    source: 'live',
  }
}

