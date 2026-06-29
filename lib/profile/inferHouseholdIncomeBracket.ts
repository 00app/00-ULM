/**
 * Infer household income bracket when profile UI has not collected it explicitly.
 * Logic-only — no UI step required.
 */

import { isHighDeprivationArea, isLowDeprivationArea } from '@/lib/intelligence/deprivationClient'
import {
  isActiveEmployed,
  isBetweenJobs,
  isHighValuePostcode,
  isStudent,
} from '@/lib/zone/zoneEligibility'

export type HouseholdIncomeBracket = '<31k' | '31k-50k' | '50k+'

export function normalizeHouseholdIncomeBracket(
  raw?: string | null
): HouseholdIncomeBracket | null {
  const b = String(raw ?? '').trim().toLowerCase()
  if (!b) return null
  if (b === '<31k' || b.startsWith('<') || b.includes('under 31')) return '<31k'
  if (b === '31k-50k' || (b.includes('31') && b.includes('50'))) return '31k-50k'
  if (b === '50k+' || b.includes('50k+') || b.includes('over 50')) return '50k+'
  return null
}

/** Infer bracket from employment, life stage, postcode affluence, and IMD — never blocks onboarding. */
export function inferHouseholdIncomeBracket(params: {
  employment_status?: string | null
  age_group?: string | null
  postcode?: string | null
  imd_decile?: number | null
  property_value_band?: string | null
  household_income_bracket?: string | null
}): HouseholdIncomeBracket | null {
  const explicit = normalizeHouseholdIncomeBracket(params.household_income_bracket)
  if (explicit) return explicit

  const employed = isActiveEmployed(params.employment_status)
  const student = isStudent(params.employment_status)
  const betweenJobs = isBetweenJobs(params.employment_status)
  const retired = String(params.age_group ?? '')
    .trim()
    .toUpperCase()
    .includes('RETIRED')
  const imd = params.imd_decile
  const affluentPostcode = isHighValuePostcode(params.postcode)
  const highValue =
    params.property_value_band === '500K_PLUS' ||
    params.property_value_band === '250K_500K'

  if (betweenJobs || (isHighDeprivationArea(imd) && !employed)) return '<31k'
  if (student) {
    if (affluentPostcode && isLowDeprivationArea(imd)) return '31k-50k'
    return '<31k'
  }
  if (retired && isHighDeprivationArea(imd)) return '<31k'
  if (employed && (affluentPostcode || highValue || isLowDeprivationArea(imd))) return '50k+'
  if (employed) return '31k-50k'
  if (retired && (affluentPostcode || isLowDeprivationArea(imd))) return '50k+'
  if (retired) return '31k-50k'
  return null
}
