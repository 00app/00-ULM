/**
 * Discovery Engine — dynamic copy for Solo Focus RESULT + injected grid cards.
 * Maps (journey, question, answer) → headline + body + deep-link (UK 2026).
 */

import type { JourneyId } from '@/lib/journeys'
import { isLoopQuestionId } from '@/lib/zone/loopQuestions'
import { homeHeatingSchemeForUser } from '@/lib/zone/homeHeatingScheme'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'

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
  answerRaw: string,
  ctx?: { postcode?: string | null; tenure?: string | null }
): DiscoveryRecommendation {
  const a = u(answerRaw)

  if (journeyId === 'home' && questionId === 'home_heat_pump') {
    if (a.includes('YES') || a.includes('CHECK')) {
      if (ctx) {
        const scheme = homeHeatingSchemeForUser(ctx)
        return {
          headline: scheme.headline,
          body: scheme.body,
          gridJourneyKey: 'home',
          learnUrl: scheme.learnUrl,
          actionUrl: scheme.ctaUrl,
          ctaLabel: scheme.ctaLabel,
          ctaUrl: scheme.ctaUrl,
        }
      }
      return {
        headline: 'HEAT PUMP GRANT CHECK',
        body: 'Government heat pump grant support can close the gap when your tariff and insulation stack — accredited installers quote against your postcode.',
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
        learnUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        actionUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        ctaLabel: 'Compare rail',
        ctaUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
      }
    }
    return {
      headline: 'FLIGHT CARBON CAP',
      body: 'If you keep flying, offset-ready tariffs and fewer legs still trim cost — compare 2026 airline bundles.',
      gridJourneyKey: 'travel',
      learnUrl: 'https://www.gov.uk/browse/abroad',
      ctaLabel: 'Travel options',
      ctaUrl: 'https://www.gov.uk/browse/abroad',
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
        learnUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
        actionUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
        ctaLabel: 'EV grant',
        ctaUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
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
    if (
      a.includes('RAIL') ||
      a.includes('TRAIN') ||
      a === 'RAIL_NOT_FLIGHT' ||
      a.includes('NOT_FLIGHT')
    ) {
      return {
        headline: 'RAIL NOT FLIGHT',
        body: 'Pattern arbitrage: rail season tickets + UK breaks vs one annual flight — often £3k+ saved on the same miles.',
        gridJourneyKey: 'travel',
        learnUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        actionUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        ctaLabel: 'See railcards',
        ctaUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
      }
    }
    if (a.includes('YES') || a.includes('SHOW') || a.includes('MAYBE')) {
      return {
        headline: 'RAIL + LOCAL SHIFT',
        body: 'Pattern arbitrage: rail season + local breaks vs one annual flight — often £3k+ saved.',
        gridJourneyKey: 'travel',
        learnUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        actionUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
        ctaLabel: 'See rail',
        ctaUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
      }
    }
    return {
      headline: 'KEEP YOUR PATTERN',
      body: 'Staying on flights? Pick direct routes and off-peak legs to trim cost without full swap.',
      gridJourneyKey: 'travel',
      learnUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
      ctaLabel: 'Compare rail',
      ctaUrl: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
    }
  }

  if (
    (journeyId === 'home' && questionId === 'energy_type') ||
    (journeyId === 'utilities' && questionId === 'home_power')
  ) {
    const gridJourneyKey = journeyId === 'utilities' ? 'utilities' : 'home'
    if (a === 'GAS') {
      const followUp = {
        question: 'Is your home insulated?',
        options: ['YES', 'NO', 'PARTIAL'],
        targetField: 'home_insulation_level',
      }
      if (ctx) {
        const scheme = homeHeatingSchemeForUser(ctx)
        return {
          headline: scheme.headline,
          body: scheme.body,
          gridJourneyKey,
          learnUrl: scheme.learnUrl,
          actionUrl: scheme.ctaUrl,
          ctaLabel: scheme.ctaLabel,
          ctaUrl: scheme.ctaUrl,
          followUp,
        }
      }
      return {
        headline: 'HEAT PUMP UPGRADE',
        body: 'Gas-heated homes can access official heat pump support up to £7,500 where rules apply — insulation quality still changes what installers quote.',
        gridJourneyKey,
        learnUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        actionUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        ctaLabel: 'Check eligibility',
        ctaUrl: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
        followUp,
      }
    }
    if (a === 'ELECTRIC') {
      return {
        headline: 'SMART TARIFF + HEAT PUMP',
        body: 'Electric homes save most by time-of-use tariffs and efficient heating — Energy Saving Trust has 2026 guides.',
        gridJourneyKey,
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
        learnUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
        actionUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
        ctaLabel: 'Chargepoint grant',
        ctaUrl: 'https://www.gov.uk/zero-emission-vehicle-grants',
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
      learnUrl: 'https://www.gov.uk/tax-relief-for-employees',
      ctaLabel: 'Explore options',
      ctaUrl: 'https://www.gov.uk/tax-relief-for-employees',
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

  if (journeyId === 'shopping' && questionId === 'shopping_repair_first') {
    if (a.includes('YES')) {
      return {
        headline: 'REPAIR CAFE NETWORK',
        body: 'The Restart Project runs 130+ free repair events UK-wide — most electrical failures are one fixable part, not a dead device.',
        gridJourneyKey: 'shopping',
        learnUrl: 'https://therestartproject.org/',
        actionUrl: 'https://therestartproject.org/',
        ctaLabel: 'Find a repair event',
        ctaUrl: 'https://therestartproject.org/',
      }
    }
    return {
      headline: 'SECOND-HAND FIRST',
      body: 'Buying new? Vinted and Back Market routinely beat new-retail prices on clothes and tech with real buyer protection.',
      gridJourneyKey: 'shopping',
      learnUrl: 'https://www.vinted.co.uk/',
      ctaLabel: 'Compare second-hand',
      ctaUrl: 'https://www.vinted.co.uk/',
    }
  }

  if (journeyId === 'tech' && questionId === 'tech_standby_off') {
    if (a.includes('YES')) {
      return {
        headline: 'AUTOMATE THE STANDBY WIN',
        body: "A £10-15 smart plug or timer does what you're already doing manually — no habit required to keep the saving.",
        gridJourneyKey: 'tech',
        learnUrl: 'https://www.ofgem.gov.uk/getting-smart-meter',
        actionUrl: 'https://www.ofgem.gov.uk/getting-smart-meter',
        ctaLabel: 'Smart meter info',
        ctaUrl: 'https://www.ofgem.gov.uk/getting-smart-meter',
      }
    }
    return {
      headline: 'STANDBY DRAW ADDS UP',
      body: 'UK households waste £35-60/yr on devices left on standby overnight — TVs, routers, and consoles are the usual culprits.',
      gridJourneyKey: 'tech',
      learnUrl: 'https://www.smartenergygb.org/smart-living/smart-energy-tips/switching-appliances-off-stand-by',
      ctaLabel: 'See the guide',
      ctaUrl: 'https://www.smartenergygb.org/smart-living/smart-energy-tips/switching-appliances-off-stand-by',
    }
  }

  if (journeyId === 'waste' && (questionId === 'waste_compost' || questionId === 'food_waste_cut')) {
    if (a.includes('YES')) {
      return {
        headline: 'WIDEN THE WASTE WIN',
        body: "Composting handles the biggest lever — TerraCycle (free, brand-funded) takes what your council bin still won't.",
        gridJourneyKey: 'waste',
        learnUrl: 'https://www.terracycle.com/en-GB/',
        actionUrl: 'https://www.terracycle.com/en-GB/',
        ctaLabel: 'Find a drop-off point',
        ctaUrl: 'https://www.terracycle.com/en-GB/',
      }
    }
    return {
      headline: 'FOOD WASTE IS 8% OF EMISSIONS',
      body: 'The average UK household bins ~£700 of food a year, most avoidable — composting diverts the methane-heavy wet waste first.',
      gridJourneyKey: 'waste',
      learnUrl: 'https://www.lovefoodhatewaste.com/',
      ctaLabel: 'Cut food waste',
      ctaUrl: 'https://www.lovefoodhatewaste.com/',
    }
  }

  if (journeyId === 'money' && questionId === 'money_smart_tariff') {
    if (a.includes('YES') || a.includes('COMPARE')) {
      return {
        headline: 'TIME THE SWITCH RIGHT',
        body: "Switching inside a fixed term can carry an exit fee — check your current deal's end date before comparing new tariffs.",
        gridJourneyKey: 'money',
        learnUrl: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
        actionUrl: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
        ctaLabel: 'Check the price cap',
        ctaUrl: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
      }
    }
    return {
      headline: 'STAYING PUT? CHECK ANYWAY',
      body: 'Even without switching supplier, moving idle savings to an ethical ISA can beat a stagnant tariff on its own.',
      gridJourneyKey: 'money',
      learnUrl: 'https://www.triodos.co.uk/ethical-isas',
      ctaLabel: 'Compare ISA rates',
      ctaUrl: 'https://www.triodos.co.uk/ethical-isas',
    }
  }

  // isLoopQuestionId(questionId) below covers every loop beat in LOOP_QUESTION_BANK. The specific
  // cases above (plus food_plant_shift/money_ev_swap earlier in this function) are the ones this
  // codebase can currently back up — the answer genuinely feeds calculateFood/Shopping/Tech/Waste/
  // Money (see lib/brains/calculations.ts) and/or a real spawned card here. For the remainder
  // (travel_ev_commute, holidays_train_not_plane, utilities_supplier_switch, home_loft_insulate,
  // solar_roof_fit, water_meter_save, carbon_offset_cut) there's no calculator or DB write behind
  // the answer yet, so the copy says what's actually true — a real category-correct resource,
  // not a claim that the app "remembers" and will act on the choice.
  if (isLoopQuestionId(questionId)) {
    const url = trustedUrlForJourney(journeyId)
    return {
      headline: "NOTED — HERE'S A TRUSTED NEXT STEP",
      body: "This category still has real UK sources worth checking, even where we can't yet tailor the number to your answer.",
      gridJourneyKey: journeyId,
      learnUrl: url,
      ctaLabel: 'See trusted source',
      ctaUrl: url,
    }
  }

  // Category-correct fallback — trustedUrlForJourney(journeyId) resolves to a real, specific
  // resource per category (Ofgem SEG for solar, WaterSure for water, TerraCycle for waste, etc.)
  // instead of a single bare gov.uk homepage shown for every journey.
  const fallbackUrl = trustedUrlForJourney(journeyId)
  return {
    headline: 'KEEP DIGGING FOR UK SAVINGS',
    body: 'Small UK-wide moves — tariffs, grants, and habits — still add up in 2026. Tap Get for trusted sources.',
    gridJourneyKey: journeyId,
    learnUrl: fallbackUrl,
    ctaLabel: 'See trusted source',
    ctaUrl: fallbackUrl,
  }
}
