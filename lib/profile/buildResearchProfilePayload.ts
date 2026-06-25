import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import {
  buildGuardrailedResearchProfile,
  type ProfileValuesInput,
} from '@/lib/profile/onboardingGuardrails'
import { readProfileFieldsFromStorage } from '@/lib/zone/safeProfileStorage'

export type { ProfileValuesInput }

/** Client + API — one guardrailed profile slice for Firecrawl/Gemini. */
export function buildResearchProfilePayload(
  values: ProfileValuesInput,
  opts?: { postcode?: string }
): ResearchProfileData {
  return buildGuardrailedResearchProfile(values, {
    postcode: opts?.postcode ?? values.postcode ?? undefined,
  })
}

/** Read localStorage profile keys into research payload (summary exit, Zone bootstrap). */
export function buildResearchProfileFromStorage(opts?: { postcode?: string }): ResearchProfileData {
  const stored = readProfileFieldsFromStorage()
  return buildGuardrailedResearchProfile(
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
      household_income_bracket: stored.household_income_bracket,
    },
    { postcode: opts?.postcode ?? stored.postcode }
  )
}
