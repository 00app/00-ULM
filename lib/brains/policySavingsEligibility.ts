/**
 * M-1 — April 2026 policy savings eligibility (price-cap step + green-levy shift).
 * Only applied when tariff + energy profile match Ofgem / dual-fuel policy scope.
 */

import {
  GREEN_LEVY_SHIFT_APRIL_2026_GBP,
  PRICE_CAP_SAVING_APRIL_1,
} from '@/lib/brains/constants'

export type PolicySavingId = 'april_price_cap_step' | 'green_levy_shift'

export interface AppliedPolicySaving {
  id: PolicySavingId
  label: string
  amountGbp: number
  reason: string
}

export function normalizeTariffType(answers: Record<string, string>): string {
  return String(answers.tariff_type ?? '').trim().toUpperCase()
}

export function resolveEnergyTypeForPolicy(answers: Record<string, string>): string {
  const raw = (answers.home_power ?? answers.energy_type ?? '').trim().toUpperCase()
  if (raw === 'MIX') return 'MIXED'
  return raw
}

/** Cap-regulated standard variable / tracker — not fixed-term or unknown. */
export function isPriceCapRegulatedTariff(tariffType: string): boolean {
  return tariffType === 'VARIABLE' || tariffType === 'TRACKER'
}

/** Domestic supply types that can receive the April cap step on typical use. */
export function hasDomesticCapSupply(energyType: string): boolean {
  return (
    energyType === 'GAS' ||
    energyType === 'ELECTRIC' ||
    energyType === 'MIXED' ||
    energyType === 'SOLAR'
  )
}

/** Dual-fuel billing scope for green-levy removal from statements. */
export function isDualFuelEnergyType(energyType: string): boolean {
  return energyType === 'GAS' || energyType === 'MIXED'
}

/**
 * Evaluate April 2026 automatic bill-policy savings for this answer set.
 * Returns empty when tariff is FIXED/UNKNOWN or supply type is out of scope.
 */
export function evaluateApril2026PolicySavings(
  answers: Record<string, string>
): AppliedPolicySaving[] {
  const tariff = normalizeTariffType(answers)
  const energy = resolveEnergyTypeForPolicy(answers)

  if (!isPriceCapRegulatedTariff(tariff)) return []

  const applied: AppliedPolicySaving[] = []

  if (hasDomesticCapSupply(energy)) {
    applied.push({
      id: 'april_price_cap_step',
      label: 'April 2026 price cap step',
      amountGbp: PRICE_CAP_SAVING_APRIL_1,
      reason: `Cap-regulated ${tariff.toLowerCase()} tariff on ${energy.toLowerCase()} supply — typical ~£${PRICE_CAP_SAVING_APRIL_1}/yr reduction from the April 1 cap period.`,
    })
  }

  if (isDualFuelEnergyType(energy)) {
    applied.push({
      id: 'green_levy_shift',
      label: 'Green levy off dual-fuel bills',
      amountGbp: GREEN_LEVY_SHIFT_APRIL_2026_GBP,
      reason: `Dual-fuel (${energy.toLowerCase()}) on a cap-regulated tariff — ~£${GREEN_LEVY_SHIFT_APRIL_2026_GBP}/yr policy levy moved from bills to general taxation from April 2026.`,
    })
  }

  return applied
}

export function sumPolicySavingsGbp(savings: AppliedPolicySaving[]): number {
  return savings.reduce((sum, line) => sum + line.amountGbp, 0)
}
