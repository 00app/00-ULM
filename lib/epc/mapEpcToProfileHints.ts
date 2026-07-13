/**
 * Map EPC register fields to onboarding / journey answer hints — never overrides explicit user choices.
 */

import type { OpenEpcProfile } from '@/lib/intelligence/openEpcClient'

export type EpcHomeAnswerHints = {
  property_type?: 'DETACHED' | 'SEMI' | 'TERRACED' | 'FLAT'
  insulation_level?: 'FULL' | 'PARTIAL' | 'NONE' | 'UNKNOWN'
  glazing_type?: 'TRIPLE' | 'DOUBLE' | 'SINGLE' | 'UNKNOWN'
}

export type EpcUtilitiesAnswerHints = {
  monthly_energy_band?: 'UNDER_100' | '100_TO_200' | 'OVER_200' | 'UNKNOWN'
}

export type EpcMoneyAnswerHints = {
  /** Derived monthly figure from EPC annual heating + hot water + lighting costs. */
  monthly_energy_bill?: number
}

export type EpcJourneyAnswerHints = {
  /** Profile-level home_power (GAS / ELECTRIC / MIX / OTHER). */
  home_power?: string
  home?: EpcHomeAnswerHints
  utilities?: EpcUtilitiesAnswerHints
  money?: EpcMoneyAnswerHints
}

export function mapEpcPropertyTypeToHomeTypeHint(
  propertyType?: string | null
): 'FLAT' | 'HOUSE' | null {
  const t = (propertyType ?? '').trim().toLowerCase()
  if (!t) return null
  if (t.includes('flat') || t.includes('maisonette') || t.includes('apartment')) return 'FLAT'
  if (
    t.includes('house') ||
    t.includes('bungalow') ||
    t.includes('cottage') ||
    t.includes('detached')
  ) {
    return 'HOUSE'
  }
  return null
}

export function mapEpcBuiltFormToPropertyType(
  builtForm?: string | null,
  propertyType?: string | null
): EpcHomeAnswerHints['property_type'] | undefined {
  const form = (builtForm ?? '').trim().toLowerCase()
  if (form.includes('detached') && !form.includes('semi')) return 'DETACHED'
  if (form.includes('semi')) return 'SEMI'
  if (form.includes('terraced') || form.includes('terrace') || form.includes('mid-terrace')) {
    return 'TERRACED'
  }
  if (form.includes('flat') || form.includes('maisonette') || form.includes('apartment')) {
    return 'FLAT'
  }

  const type = (propertyType ?? '').trim().toLowerCase()
  if (!type) return undefined
  if (type.includes('flat') || type.includes('maisonette')) return 'FLAT'
  if (type.includes('bungalow') && type.includes('detached')) return 'DETACHED'
  if (type.includes('bungalow')) return 'DETACHED'
  if (type.includes('detached')) return 'DETACHED'
  if (type.includes('semi')) return 'SEMI'
  if (type.includes('terraced') || type.includes('terrace')) return 'TERRACED'
  return undefined
}

export function mapEpcWallsToInsulationLevel(
  wallsDescription?: string | null,
  roofDescription?: string | null
): EpcHomeAnswerHints['insulation_level'] | undefined {
  const walls = (wallsDescription ?? '').trim().toLowerCase()
  const roof = (roofDescription ?? '').trim().toLowerCase()
  const combined = `${walls} ${roof}`.trim()
  if (!combined) return undefined

  if (
    combined.includes('no insulation') ||
    combined.includes('as built, no insulation') ||
    combined.includes('limited insulation')
  ) {
    return 'NONE'
  }
  if (
    combined.includes('partial') ||
    combined.includes('some insulation') ||
    combined.includes('50 mm') ||
    combined.includes('25 mm')
  ) {
    return 'PARTIAL'
  }
  if (
    combined.includes('insulated') ||
    combined.includes('200 mm') ||
    combined.includes('270 mm') ||
    combined.includes('300 mm') ||
    combined.includes('cavity wall, filled')
  ) {
    return 'FULL'
  }
  return undefined
}

export function mapEpcWindowsToGlazingType(
  windowsDescription?: string | null
): EpcHomeAnswerHints['glazing_type'] | undefined {
  const w = (windowsDescription ?? '').trim().toLowerCase()
  if (!w) return undefined
  if (w.includes('triple')) return 'TRIPLE'
  if (w.includes('single')) return 'SINGLE'
  if (w.includes('double') || w.includes('partial double') || w.includes('mostly double')) {
    return 'DOUBLE'
  }
  return undefined
}

export function mapEpcMainFuelToHomePower(
  mainFuel?: string | null,
  mainsGasFlag?: 'Y' | 'N'
): string | undefined {
  const fuel = (mainFuel ?? '').trim().toLowerCase()
  if (!fuel && !mainsGasFlag) return undefined

  if (
    fuel.includes('mains gas') ||
    fuel.includes('main gas') ||
    fuel.includes('natural gas') ||
    (fuel.includes('gas') && !fuel.includes('electric'))
  ) {
    return 'GAS'
  }
  if (fuel.includes('electric') || fuel.includes('heat pump') || fuel.includes('storage heater')) {
    return 'ELECTRIC'
  }
  if (fuel.includes('oil') || fuel.includes('lpg') || fuel.includes('solid fuel') || fuel.includes('coal')) {
    return 'OTHER'
  }
  if (fuel.includes('dual') || (fuel.includes('gas') && fuel.includes('electric'))) {
    return 'MIX'
  }
  if (mainsGasFlag === 'Y') return 'GAS'
  if (mainsGasFlag === 'N' && fuel.includes('gas')) return 'OTHER'
  return undefined
}

/** Sum annual EPC cost fields and derive utilities band + money monthly bill hint. */
export function mapEpcHeatingCostsToSpendHints(epc: Pick<
  OpenEpcProfile,
  | 'heatingCostCurrent'
  | 'lightingCostCurrent'
  | 'hotWaterCostCurrent'
>): Pick<EpcJourneyAnswerHints, 'utilities' | 'money'> {
  const annual =
    (epc.heatingCostCurrent ?? 0) +
    (epc.lightingCostCurrent ?? 0) +
    (epc.hotWaterCostCurrent ?? 0)
  if (!Number.isFinite(annual) || annual <= 0) return {}

  const monthly = Math.round(annual / 12)
  let monthly_energy_band: EpcUtilitiesAnswerHints['monthly_energy_band']
  if (monthly < 100) monthly_energy_band = 'UNDER_100'
  else if (monthly <= 200) monthly_energy_band = '100_TO_200'
  else monthly_energy_band = 'OVER_200'

  return {
    utilities: { monthly_energy_band },
    money: { monthly_energy_bill: monthly },
  }
}

/**
 * Compose all EPC → journey answer hints from a deep-read profile row.
 * Caller applies confidence / no-overwrite rules (see propertyAnswerPrefill.ts).
 */
export function mapEpcToJourneyAnswerHints(epc: OpenEpcProfile): EpcJourneyAnswerHints {
  if (!epc.found) return {}

  const spend = mapEpcHeatingCostsToSpendHints(epc)

  const home_power = mapEpcMainFuelToHomePower(epc.mainFuel, epc.mainsGasFlag)
  const property_type = mapEpcBuiltFormToPropertyType(epc.builtForm, epc.propertyType)
  const insulation_level = mapEpcWallsToInsulationLevel(epc.wallsDescription, epc.roofDescription)
  const glazing_type = mapEpcWindowsToGlazingType(epc.windowsDescription)

  const hints: EpcJourneyAnswerHints = {}

  if (home_power) hints.home_power = home_power

  const home: EpcHomeAnswerHints = {}
  if (property_type) home.property_type = property_type
  if (insulation_level) home.insulation_level = insulation_level
  if (glazing_type) home.glazing_type = glazing_type
  if (Object.keys(home).length > 0) hints.home = home

  if (spend.utilities) hints.utilities = spend.utilities
  if (spend.money) hints.money = spend.money

  return hints
}
