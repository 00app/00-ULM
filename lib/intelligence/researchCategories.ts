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
- Use **grants** when the lead instrument is an official UK scheme, voucher, or regulated subsidy (e.g. BUS / Boiler Upgrade Scheme, ECO4, Warm Home Discount, council retrofit programmes, government apply pages). Government apply URLs and scheme caps belong here even if the measure is installed in the home.
- Use **bills** when the lead is tariff, standing charge, price-cap timing, supplier switching, or direct-debit optimisation without a discrete grant application path.
- Use **utilities** when the lead is tariff type, supplier switch, monthly spend band, or dual-fuel mechanics. **home_power** is profile-only — never classify “what powers your home?” copy as utilities if profile already set it.
- Do **not** re-ask power type in utilities architect prose when home_power is present in household context.
- Use **home** for fabric, appliances, heating behaviour, insulation actions, and non-grant efficiency where the property is the locus.
- Use **money** for banking, budgeting, debt, and generic household finance not dominated by energy tariff mechanics.
- If unsure between grants and home, prefer **grants** when GOV.UK / Ofgem / council scheme eligibility is the primary call to action.
`.trim()
