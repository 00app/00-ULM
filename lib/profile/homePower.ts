/**
 * Profile leading question → journey answers for home + utilities tiles.
 */

export type ProfileHomePower = 'GAS' | 'ELECTRIC' | 'MIX' | 'OTHER'

export const PROFILE_HOME_POWER_STORAGE_KEY = 'profile_home_power'

/** Map profile option to `journey_*_answers.energy_type` / calculators. */
export function profileHomePowerToEnergyType(raw: string | null | undefined): string {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (u === 'MIX') return 'MIXED'
  if (u === 'GAS' || u === 'ELECTRIC' || u === 'OTHER') return u
  return ''
}

export function readProfileHomePowerFromStorage(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(PROFILE_HOME_POWER_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Seed `home.energy_type` + `utilities.home_power` after profile step (client only). */
export function persistHomePowerFromProfile(homePower: string): void {
  if (typeof window === 'undefined') return
  const trimmed = homePower.trim()
  if (!trimmed) return
  localStorage.setItem(PROFILE_HOME_POWER_STORAGE_KEY, trimmed)
  const energyType = profileHomePowerToEnergyType(trimmed)
  if (!energyType) return

  const mergeJson = (key: string, patch: Record<string, string>) => {
    try {
      const prev = localStorage.getItem(key)
      const base = prev ? (JSON.parse(prev) as Record<string, string>) : {}
      localStorage.setItem(key, JSON.stringify({ ...base, ...patch }))
    } catch {
      localStorage.setItem(key, JSON.stringify(patch))
    }
  }

  mergeJson('journey_home_answers', { energy_type: energyType })
  mergeJson('journey_utilities_answers', { home_power: trimmed.toUpperCase(), energy_type: energyType })
}
