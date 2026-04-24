/**
 * Carbon–Cash Calculator — March 2026 anchors for .text-data.
 * Single source of truth: lib/brains/constants.ts (MARCH_2026_ECONOMY).
 * Annual Saving (£) = (Current Usage - Optimized Usage) × Current Unit Price
 * Annual Carbon (kg) = Usage (kWh) × Carbon Factor
 */

import { MARCH_2026_ECONOMY, ELEC_PENCE_PER_KWH, GAS_PENCE_PER_KWH } from '@/lib/brains/constants'

/** March 2026 factors — derived from MARCH_2026_ECONOMY (v1.4 Spec) */
export const FACTORS_2026 = {
  ELECTRICITY_CARBON_KG_PER_KWH: MARCH_2026_ECONOMY.CARBON_FACTOR_ELEC,
  ELECTRICITY_PENCE_PER_KWH: ELEC_PENCE_PER_KWH,
  GAS_CARBON_KG_PER_KWH: MARCH_2026_ECONOMY.CARBON_FACTOR_GAS,
  GAS_PENCE_PER_KWH,
  PETROL_CARBON_KG_PER_KM: 0.165,
  PETROL_GBP_PER_LITRE: 1.42,
} as const

/**
 * Annual cash saving (£) from reduced usage.
 * Formula: (Current Usage - Optimized Usage) × Unit Price (pence/unit → £).
 * Usage in same units as price (e.g. kWh for electricity/gas).
 */
export function annualSavingGbp(
  currentUsage: number,
  optimizedUsage: number,
  unitPricePencePerUnit: number
): number {
  const usageDelta = Math.max(0, currentUsage - optimizedUsage)
  if (usageDelta <= 0) return 0
  const pricePerUnitPounds = unitPricePencePerUnit / 100
  return Math.round(usageDelta * pricePerUnitPounds * 100) / 100
}

/**
 * Annual carbon (kg CO2e) from usage.
 * Formula: Usage (kWh) × Carbon Factor.
 */
export function annualCarbonKg(usageKwh: number, carbonFactorKgPerKwh: number): number {
  return Math.round(Math.max(0, usageKwh * carbonFactorKgPerKwh))
}

/**
 * Electricity: annual saving £ and carbon kg.
 * usageKwh = annual kWh; optimizedKwh = target after measure.
 */
export function electricitySaving2026(
  currentUsageKwh: number,
  optimizedUsageKwh: number,
  unitPencePerKwh?: number
): { moneyGbp: number; carbonKg: number } {
  const pence = unitPencePerKwh ?? FACTORS_2026.ELECTRICITY_PENCE_PER_KWH
  const moneyGbp = annualSavingGbp(currentUsageKwh, optimizedUsageKwh, pence)
  const carbonKg = annualCarbonKg(
    currentUsageKwh - optimizedUsageKwh,
    FACTORS_2026.ELECTRICITY_CARBON_KG_PER_KWH
  )
  return { moneyGbp: Math.max(0, moneyGbp), carbonKg: Math.max(0, carbonKg) }
}

/**
 * Gas: annual saving £ and carbon kg.
 */
export function gasSaving2026(
  currentUsageKwh: number,
  optimizedUsageKwh: number,
  unitPencePerKwh?: number
): { moneyGbp: number; carbonKg: number } {
  const pence = unitPencePerKwh ?? FACTORS_2026.GAS_PENCE_PER_KWH
  const moneyGbp = annualSavingGbp(currentUsageKwh, optimizedUsageKwh, pence)
  const carbonKg = annualCarbonKg(
    currentUsageKwh - optimizedUsageKwh,
    FACTORS_2026.GAS_CARBON_KG_PER_KWH
  )
  return { moneyGbp: Math.max(0, moneyGbp), carbonKg: Math.max(0, carbonKg) }
}

/**
 * Petrol: carbon kg from distance (km). Money from litres × £/L (caller can compute).
 */
export function petrolCarbon2026(distanceKm: number): number {
  return Math.round(Math.max(0, distanceKm * FACTORS_2026.PETROL_CARBON_KG_PER_KM))
}

export function petrolCost2026(litres: number): number {
  return Math.round(litres * FACTORS_2026.PETROL_GBP_PER_LITRE * 100) / 100
}
