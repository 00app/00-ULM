/**
 * Live £/kWh for impact calculators — Neon research first, then /pulse living (Ofgem + Octopus).
 * Server-only (uses fetch + optional pg via liveEconomy).
 */

import { MARCH_2026_ECONOMY } from '@/lib/brains/constants'
import { getLatestResearchUnitRates } from '@/lib/db/neon'
import { getLocalData } from '@/lib/local/getLocalData'
import { fetchLivingPulseSnapshot } from '@/lib/logic/pulse'
import { getIndicativeAgilePPerKwh } from '@/lib/data/octopusPublicApis'

export type UnitRateSource = 'neon_research' | 'pulse_living' | 'octopus_agile' | 'april_2026_reference'

export type LiveUnitRateSnapshot = {
  elecGbpPerKwh: number
  gasGbpPerKwh: number
  source: UnitRateSource
  elecPPerKwh: number
  gasPPerKwh: number
}

function fromGbp(elecGbp: number, gasGbp: number, source: UnitRateSource): LiveUnitRateSnapshot {
  return {
    elecGbpPerKwh: elecGbp,
    gasGbpPerKwh: gasGbp,
    source,
    elecPPerKwh: Math.round(elecGbp * 10000) / 100,
    gasPPerKwh: Math.round(gasGbp * 10000) / 100,
  }
}

/** Resolve unit rates for home/utilities calculators (async, server routes). */
export async function resolveLiveUnitRatesForPostcode(
  postcode: string | null | undefined,
  opts?: { tariffType?: string | null; preferAgileElec?: boolean }
): Promise<LiveUnitRateSnapshot> {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  const tariff = String(opts?.tariffType ?? '').trim().toUpperCase()

  if (pc.length >= 4) {
    const row = await getLatestResearchUnitRates(pc).catch(() => null)
    const neonElec = row?.elec_unit_rate_gbp_per_kwh
    const neonGas = row?.gas_unit_rate_gbp_per_kwh
    if (
      typeof neonElec === 'number' &&
      neonElec > 0 &&
      typeof neonGas === 'number' &&
      neonGas > 0
    ) {
      return fromGbp(neonElec, neonGas, 'neon_research')
    }

    const local = await getLocalData(pc).catch(() => null)
    const pulse = await fetchLivingPulseSnapshot(pc, local).catch(() => null)
    if (pulse && pulse.electricityPPerKwh > 0 && pulse.gasPPerKwh > 0) {
      let elecP = pulse.electricityPPerKwh
      if (tariff === 'TRACKER' || opts?.preferAgileElec) {
        const agile =
          pulse.agilePPerKwh ??
          (await getIndicativeAgilePPerKwh().catch(() => null))
        if (typeof agile === 'number' && agile > 0) elecP = agile
      }
      return fromGbp(
        elecP / 100,
        pulse.gasPPerKwh / 100,
        tariff === 'TRACKER' && pulse.agilePPerKwh ? 'octopus_agile' : 'pulse_living'
      )
    }
  }

  return fromGbp(
    MARCH_2026_ECONOMY.ELEC_UNIT_RATE,
    MARCH_2026_ECONOMY.GAS_UNIT_RATE,
    'april_2026_reference'
  )
}
