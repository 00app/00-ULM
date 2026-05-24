/**
 * Utilities category lane — no drift into grants/home onboarding questions.
 */

import type { JourneyId } from '@/lib/journeys'
import { profileHomePowerToEnergyType } from '@/lib/profile/homePower'
import {
  formatUtilitiesPublicFeedBlock,
  fetchUtilitiesPublicSnapshot,
  type UtilitiesPublicSnapshot,
} from '@/lib/data/utilitiesFreeApis'

export const UTILITIES_PROFILE_POWER_RULE = `
UTILITIES LANE (mandatory when current_domain is utilities):
- **home_power** (GAS / ELECTRIC / MIX / OTHER) is captured on **/profile** only — never re-ask in Solo Focus or architect prose as if unknown.
- Triplet category must stay **utilities** for tariff, supplier switch, standing charges, and dual-fuel mechanics — not **grants** unless the primary CTA is a discrete scheme application (then use grants).
- Do not use **home** for supplier switching; do not use **bills** when the lead is explicitly utilities journey (use **bills** only for generic finance-tariff rows outside the utilities tile).
- Ground £/yr only from scraped markdown or reference cap constants — never fabricate switch savings.
`.trim()

export function buildUtilitiesLaneLockBlock(homePower?: string | null): string {
  const hp = String(homePower ?? '')
    .trim()
    .toUpperCase()
  const energy = profileHomePowerToEnergyType(hp)
  const base = [
    'CURRENT_DOMAIN: utilities — LANE LOCK active.',
    UTILITIES_PROFILE_POWER_RULE,
  ]
  if (hp) {
    base.push(
      `Profile power type (locked): ${hp}${energy ? ` → energy_type ${energy}` : ''}.`,
      'Solo Focus questions: tariff_type, supplier_switch, monthly_energy_band only.'
    )
  } else {
    base.push(
      'Profile power type not set — UTILITIES tile should remain hidden on Zone; if scraping anyway, do not invent home_power.'
    )
  }
  return base.join('\n')
}

/** Attach free API snapshot to surgical utilities scrape (server). */
export async function buildUtilitiesResearchContext(params: {
  postcode: string
  homePower?: string | null
  journeyKey: JourneyId
}): Promise<{ publicFeed?: UtilitiesPublicSnapshot; promptBlock: string }> {
  if (params.journeyKey !== 'utilities') {
    return { promptBlock: '' }
  }
  const lane = buildUtilitiesLaneLockBlock(params.homePower)
  const snapshot = await fetchUtilitiesPublicSnapshot({
    postcode: params.postcode,
    homePower: params.homePower,
  })
  if (!snapshot) return { promptBlock: lane }
  return {
    publicFeed: snapshot,
    promptBlock: `${lane}\n\n${formatUtilitiesPublicFeedBlock(snapshot)}`,
  }
}
