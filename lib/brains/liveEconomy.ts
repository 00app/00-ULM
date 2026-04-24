/**
 * Server-only: live £/kWh from Neon. Kept out of `constants.ts` so client bundles never pull `pg`.
 */

import { MARCH_2026_ECONOMY } from '@/lib/brains/constants'
import { getLatestResearchUnitRates } from '@/lib/db/neon'

export async function resolveLiveUnitRatesForPostcode(
  postcode: string | null | undefined
): Promise<{ elecGbpPerKwh: number; gasGbpPerKwh: number }> {
  const row = await getLatestResearchUnitRates(postcode)
  const elec =
    row?.elec_unit_rate_gbp_per_kwh != null && row.elec_unit_rate_gbp_per_kwh > 0
      ? row.elec_unit_rate_gbp_per_kwh
      : MARCH_2026_ECONOMY.ELEC_UNIT_RATE
  const gas =
    row?.gas_unit_rate_gbp_per_kwh != null && row.gas_unit_rate_gbp_per_kwh > 0
      ? row.gas_unit_rate_gbp_per_kwh
      : MARCH_2026_ECONOMY.GAS_UNIT_RATE
  return { elecGbpPerKwh: elec, gasGbpPerKwh: gas }
}
