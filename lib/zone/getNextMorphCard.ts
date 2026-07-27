import type { JourneyId } from '@/lib/journeys'
import { ROCK_HABITS, habitToTipCard } from '@/lib/rock/habitsCatalog'
import { filterHabitsByProfile } from '@/lib/zone/filterRockHabits'
import type { ZoneTipCard } from '@/lib/logic/zone'

type MorphProfile = {
  postcode?: string | null
  homeType?: string | null
  transport?: string | null
  /** Travel/car fuel type (petrol/diesel/EV) — used only for the transport-content scoring boost below. */
  fuelType?: string | null
  /** Home heating/power fuel (GAS/ELECTRIC/MIX/OTHER) — gates gas-only content like boiler service. */
  powerType?: string | null
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
  const journeyHabits = ROCK_HABITS.filter((h) => h.journey_key === journeyId)
  const pool = journeyHabits.length > 0 ? journeyHabits : ROCK_HABITS
  // Gate out habits that don't match the user's profile (e.g. gas-boiler-service content for an
  // ELECTRIC-only household) — same applicable.power_type/home_type gate used by the Today's Tips
  // rail. Soft gate: if it would empty the pool, fall back to the ungated pool rather than showing
  // nothing.
  const gated = filterHabitsByProfile(pool, {
    home_type: profile.homeType ?? null,
    transport: profile.transport ?? null,
    power_type: profile.powerType ?? null,
  })
  const scoringPool = gated.length > 0 ? gated : pool
  const ranked = [...scoringPool].sort(
    (a, b) => scoreHabit(b, journeyId, profile) - scoreHabit(a, journeyId, profile)
  )
  const pick = ranked.find((h) => h.journey_key === journeyId) ?? ranked[0] ?? ROCK_HABITS[0]
  return habitToTipCard(pick)
}

