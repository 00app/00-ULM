/**
 * Regional heat-pump / fabric grant caps for Solo Focus copy (Scotland / rural uplift vs England & Wales BUS).
 */

import { MARCH_2026_ECONOMY } from '@/lib/brains/constants'

/** Glasgow `G` outward + Scottish outward codes (incl. KW). */
const SCOTLAND_OUTWARD_POSTCODE = /^(G[0-9]|KW|IV|HS|PH|ZE|AB|DD|FK|PA|EH|DG|TD|ML|KY|KA)/i

/** England & Wales Boiler Upgrade Scheme cap (reference). */
export const ENGLAND_WALES_BUS_HEAT_PUMP_GBP = MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP

/**
 * Home Energy Scotland–style narrative cap for Scottish postcodes (KW seed uses £9,000 rural uplift).
 * Falls back to BUS £7,500 when not Scotland.
 */
export function regionalHeatPumpGrantGbp(postcode: string | null | undefined): number {
  const pc = postcode?.replace(/\s+/g, '').toUpperCase() ?? ''
  if (!pc) return ENGLAND_WALES_BUS_HEAT_PUMP_GBP
  if (SCOTLAND_OUTWARD_POSTCODE.test(pc)) return 9000
  return ENGLAND_WALES_BUS_HEAT_PUMP_GBP
}

/** True when UI should mention Scotland-specific grant framing (not England BUS headline). */
export function isScottishPostcodeArea(postcode: string | null | undefined): boolean {
  const pc = postcode?.replace(/\s+/g, '').toUpperCase() ?? ''
  return pc.length >= 2 && SCOTLAND_OUTWARD_POSTCODE.test(pc)
}
