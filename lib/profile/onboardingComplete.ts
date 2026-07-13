import { isValidUkPostcode } from '@/lib/geocode/ukPostcode'

export const PROFILE_GOAL_STORAGE_KEY = 'profile_goal'

export const PROFILE_STORAGE_KEYS = {
  name: 'profile_name',
  postcode: 'profile_postcode',
  houseNumber: 'profile_house_number',
  livingSituation: 'profile_household',
  homeType: 'profile_home_type',
  homeOwnership: 'profile_home_ownership',
  powerType: 'profile_home_power',
  transport: 'profile_transport',
  age: 'profile_age',
  employmentStatus: 'profile_employment_status',
} as const

export type ProfileOnboardingFields = {
  name?: string
  postcode?: string
  houseNumber?: string
  livingSituation?: string
  homeType?: string
  homeOwnership?: string
  powerType?: string
  transport?: string
  age?: string
  employmentStatus?: string
  goal?: string
}

export function resolveProfileGoalFromFields(v: ProfileOnboardingFields): string {
  return v.goal?.trim() ?? ''
}

export function isProfileOnboardingCompleteFields(v: ProfileOnboardingFields): boolean {
  const pc = (v.postcode ?? '').replace(/\s+/g, '').trim()
  return (
    Boolean(v.name?.trim()) &&
    isValidUkPostcode(pc) &&
    Boolean(v.livingSituation?.trim()) &&
    Boolean(v.homeType?.trim()) &&
    Boolean(v.homeOwnership?.trim()) &&
    Boolean(v.powerType?.trim()) &&
    Boolean(v.transport?.trim()) &&
    Boolean(v.age?.trim()) &&
    Boolean(v.employmentStatus?.trim()) &&
    Boolean(resolveProfileGoalFromFields(v))
  )
}

export function readStoredProfileGoal(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(PROFILE_GOAL_STORAGE_KEY)?.trim() ?? ''
}

/** Read onboarding fields from localStorage (client only). */
export function profileFieldsFromStorage(): ProfileOnboardingFields {
  if (typeof window === 'undefined') return {}
  const read = (key: string) => localStorage.getItem(key)?.trim() ?? ''
  return {
    name: read(PROFILE_STORAGE_KEYS.name),
    postcode: read(PROFILE_STORAGE_KEYS.postcode),
    houseNumber: read(PROFILE_STORAGE_KEYS.houseNumber),
    livingSituation: read(PROFILE_STORAGE_KEYS.livingSituation),
    homeType: read(PROFILE_STORAGE_KEYS.homeType),
    homeOwnership: read(PROFILE_STORAGE_KEYS.homeOwnership),
    powerType: read(PROFILE_STORAGE_KEYS.powerType),
    transport: read(PROFILE_STORAGE_KEYS.transport),
    age: read(PROFILE_STORAGE_KEYS.age),
    employmentStatus: read(PROFILE_STORAGE_KEYS.employmentStatus),
    goal: readStoredProfileGoal(),
  }
}

export function isStoredProfileOnboardingComplete(): boolean {
  return isProfileOnboardingCompleteFields(profileFieldsFromStorage())
}

/** True when any onboarding field is persisted — resume profile, do not skip to zone. */
export function hasPartialStoredProfile(): boolean {
  const f = profileFieldsFromStorage()
  return Object.values(f).some((v) => Boolean(v?.trim()))
}

type UserOnboardingRow = {
  name?: string | null
  postcode?: string | null
  household?: string | null
  home_type?: string | null
  transport_baseline?: string | null
  employment_status?: string | null
  age_group?: string | null
  user_genome?: Record<string, unknown> | null
}

/** Server-side — Neon `users` row matches profile onboarding completeness. */
export function userRowOnboardingComplete(row: UserOnboardingRow | null | undefined): boolean {
  if (!row) return false
  const genome = row.user_genome ?? {}
  const goal =
    (typeof genome.primary_goal === 'string' && genome.primary_goal.trim()) ||
    (typeof genome.goal === 'string' && genome.goal.trim()) ||
    (typeof genome.profile_goal === 'string' && genome.profile_goal.trim()) ||
    ''
  const homePower =
    (typeof genome.home_power === 'string' && genome.home_power.trim()) ||
    (typeof genome.homePower === 'string' && genome.homePower.trim()) ||
    ''
  const homeOwnership =
    (typeof genome.home_ownership === 'string' && genome.home_ownership.trim()) ||
    (typeof genome.homeOwnership === 'string' && genome.homeOwnership.trim()) ||
    ''
  const age =
    (typeof row.age_group === 'string' && row.age_group.trim()) ||
    (typeof genome.age_group === 'string' && genome.age_group.trim()) ||
    ''

  return isProfileOnboardingCompleteFields({
    name: row.name ?? undefined,
    postcode: row.postcode ?? undefined,
    livingSituation: row.household ?? undefined,
    homeType: row.home_type ?? undefined,
    homeOwnership: homeOwnership || undefined,
    powerType: homePower || undefined,
    transport: row.transport_baseline ?? undefined,
    age: age || undefined,
    employmentStatus: row.employment_status ?? undefined,
    goal: goal || undefined,
  })
}

export function guestProfileOnboardingComplete(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false
  const p = profile as Record<string, unknown>
  return isProfileOnboardingCompleteFields({
    name: String(p.name ?? ''),
    postcode: String(p.postcode ?? ''),
    livingSituation: String(p.household ?? p.livingSituation ?? ''),
    homeType: String(p.home_type ?? p.homeType ?? ''),
    homeOwnership: String(p.home_ownership ?? p.homeOwnership ?? ''),
    powerType: String(p.home_power ?? p.homePower ?? p.powerType ?? ''),
    transport: String(p.transport ?? p.transport_baseline ?? ''),
    age: String(p.age ?? p.age_group ?? ''),
    employmentStatus: String(p.employment_status ?? p.employmentStatus ?? ''),
    goal: String(p.goal ?? ''),
  })
}
