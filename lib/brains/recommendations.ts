/**
 * Discovery Engine — dynamic copy for Solo Focus RESULT + injected grid cards.
 * Maps (journey, question, answer) → headline + body + deep-link (UK 2026).
 */

import type { JourneyId } from '@/lib/journeys'

export interface DiscoveryRecommendation {
  /** Short shout (card title / H1 energy) */
  headline: string
  /** One line under UK average saving */
  body: string
  /** Journey tile colour / expand target in Zone */
  gridJourneyKey: JourneyId
  learnUrl: string
  actionUrl?: string
  ctaLabel: string
  ctaUrl: string
  /** Optional “context trap” for Solo Focus overlay (nested loop). */
  followUp?: { question: string; options: string[]; targetField: string }
}

function u(s: string): string {
  return s.toUpperCase().trim()
}

export function getDiscoveryRecommendation(
  journeyId: JourneyId,
  questionId: string,
  answerRaw: string
): DiscoveryRecommendation {
  const a = u(answerRaw)

  if (journeyId === 'grants' && questionId === 'boiler_age' && a === 'OVER_10YR') {
    return {
      headline: 'BUS GRANT ELIGIBLE',
      body: 'Boilers over ten years often qualify for the Boiler Upgrade Scheme — accredited installers near your postcode can quote heat pump swaps up to £7,500.',
      gridJourneyKey: 'grants',
      learnUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
      actionUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
      ctaLabel: 'Find installers',
      ctaUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
      followUp: {
        question: 'Are you on any income-related benefits?',
        options: ['YES', 'NO', 'PREFER_NOT'],
        targetField: 'income_benefits',
      },
    }
  }

  if (journeyId === 'home' && questionId === 'energy_type') {
    if (a === 'GAS') {
      return {
        headline: 'HEAT PUMP UPGRADE',
        body: 'Gas-heated homes can access official heat pump support up to £7,500 where rules apply — insulation quality still changes what installers quote.',
        gridJourneyKey: 'home',
        learnUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        actionUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        ctaLabel: 'Check eligibility',
        ctaUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        followUp: {
          question: 'Is your home insulated?',
          options: ['YES', 'NO', 'PARTIAL'],
          targetField: 'home_insulation_level',
        },
      }
    }
    if (a === 'ELECTRIC') {
      return {
        headline: 'SMART TARIFF + HEAT PUMP',
        body: 'Electric homes save most by time-of-use tariffs and efficient heating — Energy Saving Trust has 2026 guides.',
        gridJourneyKey: 'home',
        learnUrl: 'https://www.energysavingtrust.org.uk/',
        actionUrl: 'https://www.energysavingtrust.org.uk/',
        ctaLabel: 'Read the guide',
        ctaUrl: 'https://www.energysavingtrust.org.uk/',
        followUp: {
          question: 'Do you already use off-peak or smart tariff pricing?',
          options: ['YES', 'NO', 'NOT_SURE'],
          targetField: 'home_smart_tariff',
        },
      }
    }
  }

  if (journeyId === 'travel' && questionId === 'primary_transport') {
    if (a === 'CAR') {
      return {
        headline: 'EV CHARGEPOINT SAVING',
        body: 'The EV chargepoint grant and lower per-mile costs stack up — see GOV.UK chargepoint scheme.',
        gridJourneyKey: 'travel',
        learnUrl: 'https://www.gov.uk/ev-chargepoint-grant',
        actionUrl: 'https://www.gov.uk/ev-chargepoint-grant',
        ctaLabel: 'Chargepoint grant',
        ctaUrl: 'https://www.gov.uk/ev-chargepoint-grant',
        followUp: {
          question: 'Do you have off-street parking at home?',
          options: ['YES', 'NO'],
          targetField: 'travel_ev_parking',
        },
      }
    }
    return {
      headline: 'LOW-CARBON COMMUTE',
      body: 'Public and active travel keeps bills and emissions down — see local season tickets and cycle schemes.',
      gridJourneyKey: 'travel',
      learnUrl: 'https://www.gov.uk/guidance/cycle-to-work-scheme',
      ctaLabel: 'Explore options',
      ctaUrl: 'https://www.gov.uk/guidance/cycle-to-work-scheme',
    }
  }

  if (journeyId === 'food' && questionId === 'diet_type') {
    return {
      headline: 'PLATE-BY-PLATE SAVINGS',
      body: 'WRAP UK estimates households save hundreds by cutting waste and shifting protein — see Love Food Hate Waste.',
      gridJourneyKey: 'food',
      learnUrl: 'https://www.lovefoodhatewaste.com/',
      ctaLabel: 'Food waste tips',
      ctaUrl: 'https://www.lovefoodhatewaste.com/',
    }
  }

  return {
    headline: 'KEEP DIGGING',
    body: 'Small UK-wide moves — tariffs, grants, and habits — still add up in 2026. Tap Get for trusted sources.',
    gridJourneyKey: journeyId,
    learnUrl: 'https://www.gov.uk/',
    ctaLabel: 'GOV.UK hub',
    ctaUrl: 'https://www.gov.uk/',
  }
}
