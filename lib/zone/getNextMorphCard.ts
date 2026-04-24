import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import type { JourneyId } from '@/lib/journeys'
import { ROCK_HABITS, habitToTipCard } from '@/lib/rock/habitsCatalog'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'

type MorphProfile = {
  postcode?: string | null
  homeType?: string | null
  transport?: string | null
  fuelType?: string | null
}

const SCOTTISH_GRANT_URL = 'https://www.homeenergyscotland.org/funding-grants/heat-pump-grants-loans/'

function isKwScottishPostcode(postcode: string | null | undefined): boolean {
  const pc = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  return pc.startsWith('KW')
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
  if (journeyId === 'home' && isKwScottishPostcode(profile.postcode) && /(gas|mixed)/i.test(profile.fuelType ?? '')) {
    return {
      id: `fallback-scot-grant-${Date.now()}`,
      variant: 'card-compact',
      title: 'scottish heat pump uplift',
      journey_key: 'home',
      category: 'home',
      data: {
        money: formatZoneCardMoney(9000),
        carbon: formatCarbon(1200),
      },
      source: SCOTTISH_GRANT_URL,
      sourceLabel: 'source. home energy scotland',
      explanation: [
        'Scottish homes can access up to £7,500 for heat pumps plus a £1,500 rural uplift in eligible areas.',
      ],
      actions: {
        actionType: 'apply',
        learnUrl: SCOTTISH_GRANT_URL,
        actionUrl: SCOTTISH_GRANT_URL,
      },
      cta: { label: 'Check eligibility', url: SCOTTISH_GRANT_URL },
      architectSuppliedBy: 'HOME ENERGY SCOTLAND',
      dominant_win: 'money',
    }
  }

  const ranked = [...ROCK_HABITS].sort(
    (a, b) => scoreHabit(b, journeyId, profile) - scoreHabit(a, journeyId, profile)
  )
  return habitToTipCard(ranked[0] ?? ROCK_HABITS[0])
}

