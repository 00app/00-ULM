/**
 * **Current cap lock: Ofgem 1 Oct to 31 Dec 2026** (verified 23 Oct 2026 against Ofgem's unit
 * rates page). Typical dual-fuel direct debit cap **£1,723**; average direct debit unit rates
 * electricity **26.32p/kWh**, gas **7.97p/kWh**; standing charges electricity **54.83p/day**,
 * gas **29.68p/day**. Electricity carries no VAT from 1 Oct 2026 to 31 Mar 2027; gas includes
 * 5% VAT. Next cap period (1 Jan to 31 Mar 2027) is announced 25 Nov 2026: update
 * `CURRENT_CAP_UNIT_PENCE` and `CURRENT_CAP_STANDING_PENCE` then, nothing else.
 *
 * April 2026 figures stay below for historical policy-step copy only; never use them as the
 * current price.
 *
 * Live DB-backed rates: `lib/brains/liveUnitRates.ts`, not imported here (keeps client bundles free of `pg`).
 */

/** Current Ofgem typical dual-fuel cap — October 2026 window (1 Oct–31 Dec 2026). */
export const TRUTH_2026_JULY = {
  PRICE_CAP_TYPICAL_GBP: 1723,
} as const

/**
 * April 2026 policy window — historical cap step + green-levy framing (not the live cap).
 */
export const TRUTH_2026_MARCH = {
  APRIL_PRICE_CAP_TYPICAL_GBP: 1641,
  PRICE_CAP_DROP_GBP: 117,
  GREEN_LEVY_SAVING_GBP: 150,
  EV_GRANT_NEW_GBP: 500,
} as const

/** Ofgem cap period these current rates belong to. */
export const CURRENT_CAP_PERIOD = {
  label: 'Ofgem price cap, 1 October to 31 December 2026',
  start: '2026-10-01',
  end: '2026-12-31',
  sourceUrl:
    'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-unit-rates-and-standing-charges',
} as const

/** Current average direct debit unit rates (pence per kWh), see `CURRENT_CAP_PERIOD`. */
export const CURRENT_CAP_UNIT_PENCE = {
  ELECTRICITY_PER_KWH: 26.32,
  GAS_PER_KWH: 7.97,
} as const

/** Current average direct debit standing charges (pence per day), see `CURRENT_CAP_PERIOD`. */
export const CURRENT_CAP_STANDING_PENCE = {
  ELECTRICITY_PER_DAY: 54.83,
  GAS_PER_DAY: 29.68,
} as const

/**
 * VAT on domestic energy by date. Electricity is zero rated 1 Oct 2026 to 31 Mar 2027 (Ofgem);
 * gas stays at the 5% domestic rate. Cap unit rates above already reflect this.
 */
export const DOMESTIC_ENERGY_VAT_RULES = [
  { fuel: 'electricity', rate: 0, start: '2026-10-01', end: '2027-03-31', sourceUrl: CURRENT_CAP_PERIOD.sourceUrl },
] as const

export function domesticEnergyVatRate(fuel: 'electricity' | 'gas', on: Date = new Date()): number {
  const day = on.toISOString().slice(0, 10)
  for (const r of DOMESTIC_ENERGY_VAT_RULES) {
    if (r.fuel === fuel && day >= r.start && day <= r.end) return r.rate
  }
  return 0.05
}

/** April 2026 UK English display lock — matches `MARCH_2026_ECONOMY` unit rates. */
export const APRIL_2026_TRUTH_PENCE = {
  ELECTRICITY_PER_KWH: 24.67,
  GAS_PER_KWH: 5.74,
} as const

/** April 2026 default tariff — standing charges (pence per day), display lock. */
export const APRIL_2026_STANDING_PENCE = {
  ELECTRICITY_PER_DAY: 57.21,
  GAS_PER_DAY: 29.09,
} as const

/** Universal Auditor regional grid tiers (April 2026 lock). */
export const REG_HI_RURAL_G_PER_KWH = 8
export const REG_URBAN_LEZ_G_PER_KWH = 48
export const REG_GB_BASE_G_PER_KWH = 140
/** Backwards compatibility alias. */
export const UK_AVERAGE_GRID_INTENSITY_G_PER_KWH = REG_GB_BASE_G_PER_KWH
/** Backwards compatibility alias. */
export const NORTH_SCOTLAND_KW_GRID_G_PER_KWH = REG_HI_RURAL_G_PER_KWH

export const MARCH_2026_ECONOMY = {
  /** Unit rates (£/kWh): current cap, see `CURRENT_CAP_PERIOD`. Name kept for existing callers. */
  ELEC_UNIT_RATE: CURRENT_CAP_UNIT_PENCE.ELECTRICITY_PER_KWH / 100,
  ELECTRIC_UNIT_RATE: CURRENT_CAP_UNIT_PENCE.ELECTRICITY_PER_KWH / 100,
  GAS_UNIT_RATE: CURRENT_CAP_UNIT_PENCE.GAS_PER_KWH / 100,
  
  /** Octopus Export Rate */
  OCTOPUS_EXPORT_RATE: 0.12,

  /** Standing charges (£/day): current cap, see `CURRENT_CAP_PERIOD`. */
  ELEC_STANDING_CHARGE: CURRENT_CAP_STANDING_PENCE.ELECTRICITY_PER_DAY / 100,
  GAS_STANDING_CHARGE: CURRENT_CAP_STANDING_PENCE.GAS_PER_DAY / 100,

  /** Gas kg CO₂e per kWh — grid electricity uses `liveGridCarbonFactor.ts` */
  CARBON_FACTOR_GAS: 0.183,

  /** National grants (March 2026) — air-source heat pump BUS England & Wales */
  BUS_GRANT_HEAT_PUMP: 7500,
  /** Oil/LPG properties — BUS uplift from July 2026 (GOV.UK) */
  BUS_GRANT_HEAT_PUMP_OIL_LPG_FROM_JULY_2026: 9000,
  ECO4_ACTIVE: true,
  /** EV chargepoint — renters / flats from April 2026 (GOV.UK scheme rules apply) */
  EV_CHARGEPOINT_GRANT_RENTER_APRIL_GBP: TRUTH_2026_MARCH.EV_GRANT_NEW_GBP,
} as const

/** Pre–April 2026 typical household cap level (£/yr). */
export const PRICE_CAP_MARCH_2026 = 1758
/** April 2026 cap — historical reference for policy-step copy. */
export const PRICE_CAP_APRIL_2026 = TRUTH_2026_MARCH.APRIL_PRICE_CAP_TYPICAL_GBP
/** October 2026 Ofgem typical dual-fuel cap (£/yr) — current auditor lock. */
export const PRICE_CAP_JULY_2026 = TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP
export const TYPICAL_ANNUAL_CAP = PRICE_CAP_JULY_2026
export const PRICE_CAP_SAVING_APRIL_1 = TRUTH_2026_MARCH.PRICE_CAP_DROP_GBP

/** April 2026: green levies move off dual-fuel bills into general taxation. */
export const GREEN_LEVY_SHIFT_APRIL_2026_GBP = TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP

/** Citation for Solo Focus / zone copy tied to Ofgem’s typical household price cap. */
export const PRICE_CAP_SOURCE_LABEL = 'Ofgem October 2026 Announcement'
export const ELECTRIC_UNIT_RATE = MARCH_2026_ECONOMY.ELEC_UNIT_RATE
export const GAS_UNIT_RATE = MARCH_2026_ECONOMY.GAS_UNIT_RATE
export const OCTOPUS_EXPORT_RATE = MARCH_2026_ECONOMY.OCTOPUS_EXPORT_RATE
/** October 2026 citation label lock. */
export const PRICE_CAP_SOURCE_LABEL_JULY_2026 = 'Ofgem October 2026 Announcement'
/** April 2026 citation — historical policy-step copy only. */
export const PRICE_CAP_SOURCE_LABEL_APRIL_2026 = 'Ofgem April 2026 Announcement'
export const PRICE_CAP_SOURCE_URL = CURRENT_CAP_PERIOD.sourceUrl

/** Electricity pence per kWh (for legacy calculator that uses pence) */
export const ELEC_PENCE_PER_KWH = MARCH_2026_ECONOMY.ELEC_UNIT_RATE * 100
/** Gas pence per kWh */
export const GAS_PENCE_PER_KWH = MARCH_2026_ECONOMY.GAS_UNIT_RATE * 100
