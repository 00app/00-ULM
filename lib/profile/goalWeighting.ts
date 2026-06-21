/**
 * Intro + profile goal — maps to Zone tip/journey ranking (not headline £ fabrication).
 */

export type ProfileGoalValue = 'money' | 'carbon' | 'balanced'

export const INTRO_GOAL_QUESTION = 'would you like to?'

export const PROFILE_GOAL_WEIGHTS: Record<
  ProfileGoalValue,
  {
    money: number
    carbon: number
    /** Legacy compact label (SAVE / REDUCE / BOTH). */
    label: string
    /** Intro + profile circles — lowercase, line-broken for 100×100 discs. */
    displayLabel: string
    ariaLabel: string
    theme: string
  }
> = {
  money: {
    money: 0.8,
    carbon: 0.2,
    label: 'SAVE',
    displayLabel: 'save\nmoney',
    ariaLabel: 'Save money',
    theme: 'var(--color-yellow)',
  },
  carbon: {
    money: 0.2,
    carbon: 0.8,
    label: 'REDUCE',
    displayLabel: 'reduce\ncarbon',
    ariaLabel: 'Reduce carbon',
    theme: 'var(--color-pink)',
  },
  balanced: {
    money: 0.5,
    carbon: 0.5,
    label: 'BOTH',
    displayLabel: 'or\nboth',
    ariaLabel: 'Save money and reduce carbon',
    theme: 'var(--color-purple)',
  },
}

export const PROFILE_GOAL_CHOICES = (Object.keys(PROFILE_GOAL_WEIGHTS) as ProfileGoalValue[]).map(
  (value) => ({
    value,
    ...PROFILE_GOAL_WEIGHTS[value],
  })
)

export function normalizeProfileGoalValue(raw?: string | null): ProfileGoalValue {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (g === 'money' || g === 'save') return 'money'
  if (g === 'carbon' || g === 'reduce') return 'carbon'
  return 'balanced'
}

/** Used by Zone VM + grid tip sort — mirrors the three profile buttons. */
export function goalSortWeights(raw?: string | null): { money: number; carbon: number } {
  const key = normalizeProfileGoalValue(raw)
  const w = PROFILE_GOAL_WEIGHTS[key]
  return { money: w.money, carbon: w.carbon }
}
