/**
 * Household living — static switching/checking tips, one per category.
 *
 * Deliberately NOT a live research agent: no LLM call, no scraped figures, nothing that could
 * fabricate a £ or CO₂ number (the mechanical-truth rule). This is editorial guidance only —
 * general, true regardless of the user's actual tariff/provider — shown on the category's own
 * card in Settings → Living. If live per-provider research is wanted later, it plugs in here
 * behind `isLiveLlmContentEnabled()` without changing the call sites.
 */

import type { HouseholdCategory } from '@/lib/household/categories'

export const HOUSEHOLD_CATEGORY_TIPS: Record<HouseholdCategory, string> = {
  electricity: 'Check your tariff against the Ofgem price cap and compare suppliers before you renew.',
  gas: 'Check your tariff against the Ofgem price cap and compare suppliers before you renew.',
  water: "Water suppliers are regional, so you can't switch — but ask about a WaterSure or social tariff if money's tight.",
  broadband: 'Out-of-contract broadband is usually overpriced — check your contract end date and haggle or switch.',
  mobile: 'Once a handset is paid off, a SIM-only deal is almost always cheaper than sticking with the same plan.',
  council_tax: 'Check your council tax band with the VOA — some homes are banded wrong, and some households qualify for a discount.',
  mortgage: 'Check when your current deal ends — rolling onto your lender’s standard variable rate usually costs more than remortgaging.',
  rent: 'Keep your tenancy agreement and deposit protection scheme details on file in case of a dispute.',
  home_insurance: 'Insurers rarely give loyal customers the best price — get a comparison quote before it auto-renews.',
  car_insurance: 'Get a comparison quote before renewal — a new-customer quote is often cheaper than your renewal price.',
  vehicle_tax: 'Check your vehicle tax band and renewal date on the DVLA site so it never lapses.',
  subscription: "Before it renews, ask whether you've actually used it this month.",
  other: 'Check the renewal date and whether it still earns its place.',
}

export function getHouseholdCategoryTip(category: HouseholdCategory): string {
  return HOUSEHOLD_CATEGORY_TIPS[category] ?? HOUSEHOLD_CATEGORY_TIPS.other
}
