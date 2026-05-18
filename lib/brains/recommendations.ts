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

  if (journeyId === 'home' && questionId === 'home_heat_pump') {
    if (a.includes('YES') || a.includes('CHECK')) {
      return {
        headline: 'HEAT PUMP + BUS',
        body: 'Boiler Upgrade Scheme support can close the gap when your tariff and insulation stack — accredited installers quote against your postcode.',
        gridJourneyKey: 'home',
        learnUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        actionUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        ctaLabel: 'Check eligibility',
        ctaUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
      }
    }
    return {
      headline: 'STAY ON GAS — AUDIT',
      body: 'If you stay on gas, smart tariff + insulation still move the needle — Energy Saving Trust has 2026 guides.',
      gridJourneyKey: 'home',
      learnUrl: 'https://www.energysavingtrust.org.uk/',
      ctaLabel: 'Read the guide',
      ctaUrl: 'https://www.energysavingtrust.org.uk/',
    }
  }

  if (journeyId === 'travel' && questionId === 'travel_rail_vs_flight') {
    if (a.includes('YES') || a.includes('MATH') || a.includes('SHOW')) {
      return {
        headline: 'RAIL SEASON SHIFT',
        body: 'Replacing one long-haul with rail season tickets often saves £1k–£3k and cuts flight carbon in one move.',
        gridJourneyKey: 'travel',
        learnUrl: 'https://www.nationalrail.co.uk/',
        actionUrl: 'https://www.nationalrail.co.uk/',
        ctaLabel: 'Compare rail',
        ctaUrl: 'https://www.nationalrail.co.uk/',
      }
    }
    return {
      headline: 'FLIGHT CARBON CAP',
      body: 'If you keep flying, offset-ready tariffs and fewer legs still trim cost — compare 2026 airline bundles.',
      gridJourneyKey: 'travel',
      learnUrl: 'https://www.gov.uk/guidance/cycle-to-work-scheme',
      ctaLabel: 'Travel options',
      ctaUrl: 'https://www.gov.uk/guidance/cycle-to-work-scheme',
    }
  }

  if (journeyId === 'holidays' && questionId === 'holidays_local_vs_longhaul') {
    if (a.includes('YES') || a === 'MAYBE') {
      return {
        headline: 'UK STAYCATION STACK',
        body: 'Three UK breaks instead of one long-haul often pocket £1.2k+ and dodge flight surcharges.',
        gridJourneyKey: 'holidays',
        learnUrl: 'https://www.visitengland.com/',
        actionUrl: 'https://www.visitengland.com/',
        ctaLabel: 'Plan local',
        ctaUrl: 'https://www.visitengland.com/',
      }
    }
    return {
      headline: 'LONG-HAUL TRIM',
      body: 'One fewer long-haul leg per year still moves carbon — bundle hotels + rail for 2026 deals.',
      gridJourneyKey: 'holidays',
      learnUrl: 'https://www.gov.uk/browse/abroad',
      ctaLabel: 'Travel smart',
      ctaUrl: 'https://www.gov.uk/browse/abroad',
    }
  }

  if (journeyId === 'food' && questionId === 'food_plant_shift') {
    if (a.includes('YES') || a.includes('TRY')) {
      return {
        headline: 'PLANT PLATE SHIFT',
        body: 'Two plant-based meals a week typically saves ~£400/yr and ~200 kg CO₂e for UK households.',
        gridJourneyKey: 'food',
        learnUrl: 'https://www.lovefoodhatewaste.com/',
        actionUrl: 'https://www.lovefoodhatewaste.com/',
        ctaLabel: 'Food tips',
        ctaUrl: 'https://www.lovefoodhatewaste.com/',
      }
    }
    return {
      headline: 'WASTE DOWN FIRST',
      body: 'Cutting food waste before diet swaps still wins — WRAP guides for 2026 meal planning.',
      gridJourneyKey: 'food',
      learnUrl: 'https://www.lovefoodhatewaste.com/',
      ctaLabel: 'Start here',
      ctaUrl: 'https://www.lovefoodhatewaste.com/',
    }
  }

  if (journeyId === 'money' && questionId === 'money_ev_swap') {
    if (a.includes('YES') || a.includes('COMPARE')) {
      return {
        headline: 'USED EV GRANT',
        body: 'EV chargepoint grant plus lower pence-per-mile often beats petrol when grants close the upfront gap.',
        gridJourneyKey: 'money',
        learnUrl: 'https://www.gov.uk/ev-chargepoint-grant',
        actionUrl: 'https://www.gov.uk/ev-chargepoint-grant',
        ctaLabel: 'EV grant',
        ctaUrl: 'https://www.gov.uk/ev-chargepoint-grant',
      }
    }
    return {
      headline: 'PETROL RUN COST',
      body: 'Keeping petrol? Smarter insurance + mileage caps still claw back hundreds in 2026.',
      gridJourneyKey: 'money',
      learnUrl: 'https://www.moneyhelper.org.uk/',
      ctaLabel: 'Compare costs',
      ctaUrl: 'https://www.moneyhelper.org.uk/',
    }
  }

  if (questionId === 'lifestyle_shift_pattern') {
    if (a.includes('YES') || a.includes('SHOW') || a.includes('MAYBE')) {
      return {
        headline: 'RAIL + LOCAL SHIFT',
        body: 'Pattern arbitrage: rail season + local breaks vs one annual flight — often £3k+ saved.',
        gridJourneyKey: 'travel',
        learnUrl: 'https://www.nationalrail.co.uk/',
        actionUrl: 'https://www.nationalrail.co.uk/',
        ctaLabel: 'See rail',
        ctaUrl: 'https://www.nationalrail.co.uk/',
      }
    }
    return {
      headline: 'KEEP YOUR PATTERN',
      body: 'Staying on flights? Pick direct routes and off-peak legs to trim cost without full swap.',
      gridJourneyKey: 'travel',
      learnUrl: 'https://www.gov.uk/',
      ctaLabel: 'GOV.UK hub',
      ctaUrl: 'https://www.gov.uk/',
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
