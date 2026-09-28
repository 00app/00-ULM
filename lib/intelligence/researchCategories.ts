import { JOURNEY_IDS } from '@/lib/journeys'

/**
 * Extra `research_results.category` values beyond core `JourneyId`.
 * Hermes / Gemini may emit these so government schemes stay typed without faking `home`.
 */
/** Neon-only categories outside the 13 journey tiles (no grid fold — `bills` rows map to `money` in queries only). */
export const EXTENDED_RESEARCH_CATEGORIES = ['bills'] as const
export type ExtendedResearchCategory = (typeof EXTENDED_RESEARCH_CATEGORIES)[number]

const EXTENDED_SET = new Set<string>(EXTENDED_RESEARCH_CATEGORIES)

/** Valid categories for Neon rows + Gemini triplet JSON (includes `general` bucket). */
export function isAllowedResearchCategory(raw: string | null | undefined): boolean {
  const s = raw?.trim().toLowerCase()
  if (!s) return false
  if (s === 'general') return true
  if (EXTENDED_SET.has(s)) return true
  return (JOURNEY_IDS as readonly string[]).includes(s)
}

/** Employment / postcode affluence — appended with profile context in researchAgent. */
export const AFFLUENCE_AUDITOR_PROTOCOL = `
Affluence auditor (when profile includes employment_status):
- If employment_status is employed and the household is not low-income (<31k bracket), and the postcode is not in a deprived area, DEPRIORITIZE ECO4 and HUG2 grants in prose and category choice unless scraped evidence proves eligibility.
- If employment_status is student or between jobs, keep bill-survival and grant-capable routes visible unless affluent evidence says otherwise.
- For employed / affluent postcodes, pivot to Section 136PJ logic: solar ROI, EV salary sacrifice, smart/agile export tariffs — Asset Optimization tone, not Bill Survival.
- For unemployed, retired, or <31k income bracket, lead with Warm Homes, ECO4/BUS, and council Statement-of-Intent pathways when markdown supports them.
`.trim()

/** Short block appended to research triplet prompts — not raw data, routing rules only. */
export const GRANTS_AND_BILLS_CATEGORY_PROTOCOL = `
Category routing (mandatory):
- Use **home** for fabric, appliances, heating behaviour, insulation actions, and efficiency where the property is the locus, including official UK schemes, vouchers, or regulated subsidies that fund that work (e.g. BUS / Boiler Upgrade Scheme, ECO4, Warm Home Discount, council retrofit programmes, government apply pages). Government apply URLs and scheme caps belong here even though the measure is installed in the home. There is no separate "grants" category: grant-funded home efficiency work is **home**, not its own bucket.
- Use **bills** when the lead is tariff, standing charge, price-cap timing, supplier switching, or direct-debit optimisation without a discrete grant application path.
- Use **utilities** when the lead is tariff type, supplier switch, monthly spend band, or dual-fuel mechanics. **home_power** is profile-only, never classify "what powers your home?" copy as utilities if profile already set it.
- Do **not** re-ask power type in utilities architect prose when home_power is present in household context.
- Use **money** for banking, budgeting, debt, and generic household finance not dominated by energy tariff mechanics.
- If unsure between a grant scheme and general home efficiency, use **home** either way, both are the same category here.
`.trim()
