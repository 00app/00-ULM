import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import { normalizeProfileGoalValue } from '@/lib/profile/goalWeighting'
import { profileHomePowerToEnergyType } from '@/lib/profile/homePower'
import { readProfileFieldsFromStorage } from '@/lib/zone/safeProfileStorage'

export type ProfileValuesInput = Record<string, string | null | undefined>

function compactPostcode(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
}

/** Client + API — one profile slice for Firecrawl/Gemini (postcode, house number, goal, power). */
export function buildResearchProfilePayload(
  values: ProfileValuesInput,
  opts?: { postcode?: string }
): ResearchProfileData {
  const goal = normalizeProfileGoalValue(values.goal ?? values.profile_goal)
  const power = values.powerType ?? values.home_power ?? values.profile_home_power
  const ageRaw = values.age ?? values.profile_age
  const age =
    typeof ageRaw === 'string' && ['JUNIOR', 'MID', 'RETIRED'].includes(ageRaw.trim().toUpperCase())
      ? ageRaw.trim().toUpperCase()
      : undefined
  const pc = compactPostcode(opts?.postcode ?? values.postcode)
  const houseNumber = values.houseNumber ?? values.house_number

  return {
    ...(pc.length >= 4 ? { postcode: pc } : {}),
    home_type: values.homeType ?? values.home_type ?? undefined,
    home_power: power?.trim().toUpperCase() || undefined,
    heating: profileHomePowerToEnergyType(power) || undefined,
    transport_baseline: values.transport ?? values.transport_baseline ?? undefined,
    household: values.livingSituation ?? values.household ?? undefined,
    employment_status: values.employmentStatus ?? values.employment_status ?? undefined,
    house_number: houseNumber?.trim() || undefined,
    goal,
    primary_goal: goal,
    ...(age ? { age_group: age } : {}),
  }
}

/** Read localStorage profile keys into research payload (summary exit, Zone bootstrap). */
export function buildResearchProfileFromStorage(opts?: { postcode?: string }): ResearchProfileData {
  const stored = readProfileFieldsFromStorage()
  return buildResearchProfilePayload(
    {
      postcode: opts?.postcode ?? stored.postcode,
      homeType: stored.home_type,
      powerType: stored.home_power,
      transport: stored.transport_baseline,
      livingSituation: stored.household,
      employmentStatus: stored.employment_status,
      houseNumber: stored.house_number,
      goal: stored.goal,
      age: stored.age,
    },
    { postcode: opts?.postcode ?? stored.postcode }
  )
}
