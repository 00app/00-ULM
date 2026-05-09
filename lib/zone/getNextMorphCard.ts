import type { JourneyId } from '@/lib/journeys'
import { ROCK_HABITS, habitToTipCard } from '@/lib/rock/habitsCatalog'
import type { ZoneTipCard } from '@/lib/logic/zone'

type MorphProfile = {
  postcode?: string | null
  homeType?: string | null
  transport?: string | null
  fuelType?: string | null
}

function scoreHabit(
  habit: { journey_key: JourneyId; money_gbp: number; carbon_kg: number; title: string; insight: string },
  journeyId: JourneyId,
  profile: MorphProfile
): number {
  let score = habit.money_gbp + Math.round(habit.carbon_kg * 0.35)
  if (habit.journey_key === journeyId) score += 180

  const blob = `${habit.title} ${habit.insight}`.toLowerCase()
  const transport = (profile.transport ?? '').toLowerCase()
  const fuelType = (profile.fuelType ?? '').toLowerCase()
  const homeType = (profile.homeType ?? '').toLowerCase()

  if (/(petrol|diesel|car|engine|fuel|mpg)/.test(blob) && /(car|petrol|diesel)/.test(`${transport} ${fuelType}`)) {
    score += 120
  }
  if (/(heating|insulation|boiler|heat pump|radiator)/.test(blob) && /(house|flat|home)/.test(homeType)) {
    score += 80
  }
  return score
}

/**
 * Fallback morph birth to keep Solo Focus alive when API returns no morph cards.
 */
export function getNextMorphCard(journeyId: JourneyId, profile: MorphProfile): ZoneTipCard {
  const ranked = [...ROCK_HABITS].sort(
    (a, b) => scoreHabit(b, journeyId, profile) - scoreHabit(a, journeyId, profile)
  )
  return habitToTipCard(ranked[0] ?? ROCK_HABITS[0])
}

