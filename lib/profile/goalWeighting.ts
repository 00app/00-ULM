/**
 * Profile “what is your goal?” — maps to Zone tip/journey ranking (not headline £ fabrication).
 */

export type ProfileGoalValue = 'money' | 'carbon' | 'balanced'

export const PROFILE_GOAL_WEIGHTS: Record<
  ProfileGoalValue,
  { money: number; carbon: number; label: string; theme: string }
> = {
  money: { money: 0.8, carbon: 0.2, label: 'SAVE', theme: 'var(--color-yellow)' },
  carbon: { money: 0.2, carbon: 0.8, label: 'REDUCE', theme: 'var(--color-pink)' },
  balanced: { money: 0.5, carbon: 0.5, label: 'BOTH', theme: 'var(--color-purple)' },
}

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
