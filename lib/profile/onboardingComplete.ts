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
  washPreference: 'profile_wash_preference',
  flightFrequency: 'profile_flight_frequency',
  age: 'profile_age',
  employmentStatus: 'profile_employment_status',
  financialPressure: 'profile_financial_pressure',
  children: 'profile_children',
  helpGoal: 'profile_help_goal',
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
  washPreference?: string
  flightFrequency?: string
  age?: string
  employmentStatus?: string
  /**
   * TIGHT | GETTING_BY | DOING_OK — self-reported financial headroom. This is the ceiling on
   * what a recommendation is allowed to cost before it's worth showing at all, so the action
   * ranker treats it as always present rather than carrying a null path through every score.
   * Required in `isProfileOnboardingCompleteFields` for that reason.
   */
  financialPressure?: string
  /**
   * NO | UNDER_5 | SCHOOL_AGE | BOTH. Required, because child entitlements are gated on it and a
   * permissive gate on an unknown value would show free school meals to a childless household —
   * the exact over-claiming this question exists to stop.
   */
  children?: string
  /**
   * CUT_BILLS | CLEAR_DEBT | FIND_WORK | KEEP_HOME — where they want to get to, which is how we
   * learn someone is in trouble without asking them to say so. Required: the wall routes through
   * crisis triage on this, and defaulting it would silently drop someone back to bill tips.
   */
  helpGoal?: string
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
    Boolean(v.washPreference?.trim()) &&
    Boolean(v.flightFrequency?.trim()) &&
    Boolean(v.age?.trim()) &&
    Boolean(v.employmentStatus?.trim()) &&
    Boolean(v.financialPressure?.trim()) &&
    Boolean(v.children?.trim()) &&
    Boolean(v.helpGoal?.trim()) &&
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
    washPreference: read(PROFILE_STORAGE_KEYS.washPreference),
    flightFrequency: read(PROFILE_STORAGE_KEYS.flightFrequency),
    age: read(PROFILE_STORAGE_KEYS.age),
    employmentStatus: read(PROFILE_STORAGE_KEYS.employmentStatus),
    financialPressure: read(PROFILE_STORAGE_KEYS.financialPressure),
    children: read(PROFILE_STORAGE_KEYS.children),
    helpGoal: read(PROFILE_STORAGE_KEYS.helpGoal),
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
  const washPreference =
    (typeof genome.wash_preference === 'string' && genome.wash_preference.trim()) ||
    (typeof genome.washPreference === 'string' && genome.washPreference.trim()) ||
    ''
  const flightFrequency =
    (typeof genome.flight_frequency === 'string' && genome.flight_frequency.trim()) ||
    (typeof genome.flightFrequency === 'string' && genome.flightFrequency.trim()) ||
    ''
  const age =
    (typeof row.age_group === 'string' && row.age_group.trim()) ||
    (typeof genome.age_group === 'string' && genome.age_group.trim()) ||
    ''
  const financialPressure =
    (typeof genome.financial_pressure === 'string' && genome.financial_pressure.trim()) ||
    (typeof genome.financialPressure === 'string' && genome.financialPressure.trim()) ||
    ''
  const children =
    (typeof genome.children === 'string' && genome.children.trim()) || ''
  const helpGoal =
    (typeof genome.help_goal === 'string' && genome.help_goal.trim()) || ''

  return isProfileOnboardingCompleteFields({
    name: row.name ?? undefined,
    postcode: row.postcode ?? undefined,
    livingSituation: row.household ?? undefined,
    homeType: row.home_type ?? undefined,
    homeOwnership: homeOwnership || undefined,
    powerType: homePower || undefined,
    transport: row.transport_baseline ?? undefined,
    washPreference: washPreference || undefined,
    flightFrequency: flightFrequency || undefined,
    age: age || undefined,
    employmentStatus: row.employment_status ?? undefined,
    financialPressure: financialPressure || undefined,
    children: children || undefined,
    helpGoal: helpGoal || undefined,
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
    washPreference: String(p.wash_preference ?? p.washPreference ?? ''),
    flightFrequency: String(p.flight_frequency ?? p.flightFrequency ?? ''),
    age: String(p.age ?? p.age_group ?? ''),
    employmentStatus: String(p.employment_status ?? p.employmentStatus ?? ''),
    financialPressure: String(p.financial_pressure ?? p.financialPressure ?? ''),
    children: String(p.children ?? ''),
    helpGoal: String(p.help_goal ?? p.helpGoal ?? ''),
    goal: String(p.goal ?? ''),
  })
}
