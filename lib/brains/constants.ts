/**
 * **April 2026 hard-lock (v6.4 auditor)** — display and Sentinel truth strings use:
 * Electricity **24.67p/kWh**, gas **5.74p/kWh**, typical cap **£1,641** (`APRIL_2026_TRUTH_PENCE`, `TRUTH_2026_MARCH.APRIL_PRICE_CAP_TYPICAL_GBP`).
 * Unit £/kWh for calculators: `MARCH_2026_ECONOMY` (locked to the same April reference rates).
 *
 * Live DB-backed rates: `lib/brains/liveEconomy.ts` — not imported here (keeps client bundles free of `pg`).
 */

/**
 * Verified baseline — grid intensity and April cap headline (**v6.4**).
 * April typical cap **£1,641** (`APRIL_PRICE_CAP_TYPICAL_GBP`); green-levy shift **£150** (`GREEN_LEVY_SAVING_GBP`).
 * All spend-to-carbon paths use `GRID_INTENSITY` → **0.129 kg CO₂e/kWh** via `MARCH_2026_ECONOMY.CARBON_FACTOR_ELEC`.
 */
export const TRUTH_2026_MARCH = {
  GRID_INTENSITY_G_PER_KWH: 129,
  APRIL_PRICE_CAP_TYPICAL_GBP: 1641,
  PRICE_CAP_DROP_GBP: 117,
  GREEN_LEVY_SAVING_GBP: 150,
  EV_GRANT_NEW_GBP: 500,
} as const

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
  /** Unit rates — April 2026: Electricity £0.2467/kWh, Gas £0.0574/kWh */
  ELEC_UNIT_RATE: 0.2467,
  ELECTRIC_UNIT_RATE: 0.2467,
  GAS_UNIT_RATE: 0.0574,
  
  /** Octopus Export Rate */
  OCTOPUS_EXPORT_RATE: 0.12,

  /** Standing charges (£/day) — April 2026 lock */
  ELEC_STANDING_CHARGE: APRIL_2026_STANDING_PENCE.ELECTRICITY_PER_DAY / 100,
  GAS_STANDING_CHARGE: APRIL_2026_STANDING_PENCE.GAS_PER_DAY / 100,

  /** kg CO₂e per kWh — locked to TRUTH_2026_MARCH.GRID_INTENSITY (129 g) */
  CARBON_FACTOR_ELEC: TRUTH_2026_MARCH.GRID_INTENSITY_G_PER_KWH / 1000,
  CARBON_FACTOR_GAS: 0.183,

  /** National grants (March 2026) */
  BUS_GRANT_HEAT_PUMP: 7500,
  ECO4_ACTIVE: true,
  /** EV chargepoint — renters / flats from April 2026 (GOV.UK scheme rules apply) */
  EV_CHARGEPOINT_GRANT_RENTER_APRIL_GBP: TRUTH_2026_MARCH.EV_GRANT_NEW_GBP,
} as const

/** Pre–April 2026 typical household cap level (£/yr). */
export const PRICE_CAP_MARCH_2026 = 1758
export const PRICE_CAP_APRIL_2026 = TRUTH_2026_MARCH.APRIL_PRICE_CAP_TYPICAL_GBP
export const TYPICAL_ANNUAL_CAP = PRICE_CAP_APRIL_2026
export const PRICE_CAP_SAVING_APRIL_1 = TRUTH_2026_MARCH.PRICE_CAP_DROP_GBP

/** April 2026: green levies move off dual-fuel bills into general taxation. */
export const GREEN_LEVY_SHIFT_APRIL_2026_GBP = TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP

/** Citation for Solo Focus / zone copy tied to Ofgem’s typical household price cap. */
export const PRICE_CAP_SOURCE_LABEL = 'Ofgem April 2026 Announcement'
export const ELECTRIC_UNIT_RATE = MARCH_2026_ECONOMY.ELEC_UNIT_RATE
export const GAS_UNIT_RATE = MARCH_2026_ECONOMY.GAS_UNIT_RATE
export const OCTOPUS_EXPORT_RATE = MARCH_2026_ECONOMY.OCTOPUS_EXPORT_RATE
/** April 2026 citation label lock. */
export const PRICE_CAP_SOURCE_LABEL_APRIL_2026 = 'Ofgem April 2026 Announcement'
export const PRICE_CAP_SOURCE_URL =
  'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'

/** Electricity pence per kWh (for legacy calculator that uses pence) */
export const ELEC_PENCE_PER_KWH = MARCH_2026_ECONOMY.ELEC_UNIT_RATE * 100
/** Gas pence per kWh */
export const GAS_PENCE_PER_KWH = MARCH_2026_ECONOMY.GAS_UNIT_RATE * 100
