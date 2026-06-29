/**
 * Affluence / employment auditor — filters grant-heavy surfaces for employed + polished postcodes.
 * LSOA 1–3 is not in Neon yet; household_income_bracket + outward postcode proxy until IMD lands.
 */

import {
  filterTipsForEmployment,
  isHighValuePostcode,
} from '@/lib/zone/zoneEligibility'
import {
  isActiveEmployed,
  isBillSurvivalSegment,
  isStudent,
} from '@/lib/profile/employmentSegment'

export type AffluenceAuditMode = 'asset_optimization' | 'bill_survival'

export type AffluenceProfileInput = {
  employment_status?: string | null
  postcode?: string | null
  household_income_bracket?: string | null
  primary_goal?: string | null
}

/** Maps client `profile_goal` to SQL `primary_goal` column values. */
export function mapProfileGoalToPrimaryGoal(raw?: string | null): 'save' | 'reduce' | 'both' {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (g === 'money' || g === 'save') return 'save'
  if (g === 'carbon' || g === 'reduce') return 'reduce'
  return 'both'
}

/** Maps SQL `primary_goal` + legacy `profile_goal` to grid sort keys. */
export function normalizePrimaryGoal(raw?: string | null): 'money' | 'carbon' | 'balanced' {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (g === 'save' || g === 'money') return 'money'
  if (g === 'reduce' || g === 'carbon') return 'carbon'
  if (g === 'both' || g === 'balanced' || !g) return 'balanced'
  return 'balanced'
}

export function isLowIncomeBracket(bracket?: string | null): boolean {
  const b = String(bracket ?? '')
    .trim()
    .toLowerCase()
  if (!b) return false
  return (
    b === '<31k' ||
    b.startsWith('<') ||
    b.includes('under 31') ||
    b.includes('below 31')
  )
}

export function resolveAffluenceAuditMode(input: AffluenceProfileInput): {
  mode: AffluenceAuditMode
  deprioritizeMeansTestedGrants: boolean
} {
  const employed = isActiveEmployed(input.employment_status)
  const student = isStudent(input.employment_status)
  const billSurvival = isBillSurvivalSegment(input.employment_status)
  const polished = isHighValuePostcode(input.postcode)
  const lowIncome = isLowIncomeBracket(input.household_income_bracket)

  if (billSurvival) {
    return { mode: 'bill_survival', deprioritizeMeansTestedGrants: false }
  }
  if (employed && (polished || !lowIncome) && !lowIncome && !student) {
    return { mode: 'asset_optimization', deprioritizeMeansTestedGrants: true }
  }
  return { mode: 'bill_survival', deprioritizeMeansTestedGrants: false }
}

/** Gemini / Zai system block — employment vs grants + Section 136PJ pivot. */
export function buildAffluenceAuditorPromptBlock(input: AffluenceProfileInput): string {
  const { mode, deprioritizeMeansTestedGrants } = resolveAffluenceAuditMode(input)
  const employed = isActiveEmployed(input.employment_status)
  const polished = isHighValuePostcode(input.postcode)
  const lines = [
    'Affluence auditor (mandatory):',
    `- employment_status: ${input.employment_status?.trim() || 'unknown'}`,
    `- household_income_bracket: ${input.household_income_bracket?.trim() || 'unknown'}`,
    `- audit_mode: ${mode}`,
  ]
  if (deprioritizeMeansTestedGrants || (employed && polished)) {
    lines.push(
      '- If employment_status is employed and the household is not low-income (<31k), DEPRIORITIZE ECO4 and HUG2 grant-led copy unless markdown proves eligibility.',
      '- Pivot to Section 136PJ logic: solar ROI, EV salary sacrifice, smart/agile export tariffs, and investment-grade efficiency — not bill-survival framing.',
      polished
        ? '- Postcode reads as affluent: use Asset Optimization tone (legacy efficiency, ROI, export income) — not Bill Survival.'
        : '- Use a productivity / investment tone rather than means-tested grant urgency.'
    )
  } else if (isStudent(input.employment_status)) {
    lines.push(
      '- Student segment: lead with shared-bill habits, low-upfront tech longevity, and budget food wins — keep council/grant routes when eligibility evidence exists.',
      '- Do not assume parental affluence; postcode and household context govern grant tone.'
    )
  } else if (isBillSurvivalSegment(input.employment_status)) {
    lines.push(
      '- Between jobs: lead with bill survival, Warm Homes / council schemes, and means-tested grants when evidence supports eligibility.'
    )
  } else {
    lines.push(
      '- Lead with bill survival, Warm Homes / council schemes, and means-tested grants when evidence supports eligibility.'
    )
  }
  return `${lines.join('\n')}\n\n`
}

export {
  filterTipsForEmployment,
  isHighValuePostcode,
} from '@/lib/zone/zoneEligibility'
export { isActiveEmployed, isStudent, isBetweenJobs } from '@/lib/profile/employmentSegment'
