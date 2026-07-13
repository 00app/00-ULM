/**
 * ZERO ZERO — Impact calculations (UK annualized).
 *
 * v42.8 — April–June 2026 lock: electricity **24.67p/kWh**, gas **5.74p/kWh** (`MARCH_2026_ECONOMY`),
 * Policy savings (cap step / green levy) are conditional on tariff + energy type — see `policySavingsEligibility.ts`.
 * Re-exported aliases: `BASELINE_2026_CAP_GBP`, `ELEC_UNIT_RATE_PENCE`, `GAS_UNIT_RATE_PENCE`.
 * Scraped/live rates: `buildUserImpact` + `scrapedOverlay`.
 */
import {
  electricitySaving2026,
  gasSaving2026,
  annualCarbonKg,
  petrolCarbon2026,
  petrolCost2026,
} from '@/lib/carbonCashCalculator'
import {
  gridCarbonContextForPostcode,
  type GridCarbonContext,
} from '@/lib/brains/liveGridCarbonFactor'
import type { UnitRateSource } from '@/lib/brains/liveUnitRates'
import {
  evaluateApril2026PolicySavings,
  sumPolicySavingsGbp,
  type AppliedPolicySaving,
} from '@/lib/brains/policySavingsEligibility'

import {
  MARCH_2026_ECONOMY,
  PRICE_CAP_APRIL_2026,
  TRUTH_2026_MARCH,
  TRUTH_2026_JULY,
  APRIL_2026_TRUTH_PENCE,
  PRICE_CAP_SAVING_APRIL_1,
  TYPICAL_ANNUAL_CAP,
} from '@/lib/brains/constants'
import type { JourneyId } from '@/lib/journeys'
import type { EmploymentStatus } from '@/lib/brains/types'
import { formatZoneCardMoney } from '@/lib/format'

export { normalizeEmploymentStatus } from '@/lib/profile/employmentSegment'

/** July 2026 typical household cap (£/yr) — single import for summary + calculators. */
export const BASELINE_2026_CAP_GBP = TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP
export const ELEC_UNIT_RATE_PENCE = APRIL_2026_TRUTH_PENCE.ELECTRICITY_PER_KWH
export const GAS_UNIT_RATE_PENCE = APRIL_2026_TRUTH_PENCE.GAS_PER_KWH

export { formatMoneyValue, formatCarbonValue, getMoneyStampParts, getCarbonStampParts } from '@/lib/format'

export type { AppliedPolicySaving }

export interface ImpactResult {
  carbonKg: number
  moneyGbp: number
  source: string
  explanation: string[]
  /** April 2026 policy lines included in moneyGbp — UI can explain each reduction */
  policySavings?: AppliedPolicySaving[]
  /** Where elec/gas unit rates came from for this calculation */
  unitRateSource?: UnitRateSource
  /** Verified unit rates used (p/kWh) when live feed supplied */
  unitRatesPence?: { elec: number; gas: number }
  /** Boiler Upgrade Scheme / EV grant link when eligible */
  claimOfferUrl?: string | null
  /** One-line tip for Zone card (e.g. eligibility, EV switch) */
  insight?: string | null
}

/** Rough annual kWh from monthly £ spend (split 60% elec / 40% gas by cost at 2026 prices). */
function annualKwhFromSpend(
  monthlyGbp: number,
  elecUnitRate: number,
  gasUnitRate: number
): { elecKwh: number; gasKwh: number } {
  const annualGbp = monthlyGbp * 12
  const elecShare = 0.6
  const gasShare = 0.4
  const elecGbp = annualGbp * elecShare
  const gasGbp = annualGbp * gasShare
  const elecKwh = elecUnitRate > 0 ? elecGbp / elecUnitRate : 0
  const gasKwh = gasUnitRate > 0 ? gasGbp / gasUnitRate : 0
  return { elecKwh, gasKwh }
}

export function calculateHome(
  a: Record<string, string>,
  unitRates?: {
    elecGbpPerKwh: number
    gasGbpPerKwh: number
    source?: UnitRateSource
    elecPPerKwh?: number
    gasPPerKwh?: number
  },
  gridCarbon?: GridCarbonContext
): ImpactResult {
  const elecCarbonKg = gridCarbon?.elecCarbonKgPerKwh ?? gridCarbonContextForPostcode().elecCarbonKgPerKwh
  const gasCarbonKg = MARCH_2026_ECONOMY.CARBON_FACTOR_GAS
  const elecR = unitRates?.elecGbpPerKwh ?? MARCH_2026_ECONOMY.ELEC_UNIT_RATE
  const gasR = unitRates?.gasGbpPerKwh ?? MARCH_2026_ECONOMY.GAS_UNIT_RATE
  const elecPence = unitRates?.elecPPerKwh ?? elecR * 100
  const gasPence = unitRates?.gasPPerKwh ?? gasR * 100
  const unitRateSource: UnitRateSource = unitRates?.source ?? 'april_2026_reference'
  const monthly = Number(a.monthly_cost ?? 120)
  const { elecKwh, gasKwh } = annualKwhFromSpend(monthly, elecR, gasR)
  const carbonElec = annualCarbonKg(elecKwh, elecCarbonKg)
  const carbonGas = annualCarbonKg(gasKwh, gasCarbonKg)
  let carbon = carbonElec + carbonGas
  if (a.energy_type === 'ELECTRIC') carbon = Math.max(0, carbon - 600)
  let money = 0
  if (a.green_tariff === 'NO') money += 120
  if (
    a.green_tariff === 'NO' &&
    ((a.electricity_provider && a.electricity_provider !== 'OCTOPUS') ||
      (a.gas_provider && a.gas_provider !== 'OCTOPUS'))
  ) {
    const optElec = elecKwh * 0.85
    const optGas = gasKwh * 0.9
    const saved = electricitySaving2026(elecKwh, optElec, elecPence, elecCarbonKg)
    const savedGas = gasSaving2026(gasKwh, optGas, gasPence)
    money += Math.round(saved.moneyGbp + savedGas.moneyGbp)
  }

  const policySavings = evaluateApril2026PolicySavings(a)
  money += sumPolicySavingsGbp(policySavings)

  const hasLeakOpportunity = a.energy_type === 'GAS'
  const isSolar = String(a.energy_type ?? '').toUpperCase() === 'SOLAR'
  const capLead =
    policySavings.length > 0
      ? `April 2026 policy savings applied: ${policySavings.map((p) => `${p.label} (~£${p.amountGbp})`).join('; ')}.`
      : `No automatic April 2026 cap or green-levy savings applied — fixed/unknown tariff or supply type out of policy scope.`
  const unitLead = `Unit rates (${unitRateSource.replace(/_/g, ' ')}): ${elecPence.toFixed(2)}p/kWh electricity, ${gasPence.toFixed(2)}p/kWh gas.`
  const warmHomesLead =
    isSolar || String(a.energy_type ?? '').toUpperCase() === 'ELECTRIC'
      ? `£15bn Warm Homes Plan: low-interest loans for solar/batteries and street-level upgrades — stack with your audit.`
      : `£15bn Warm Homes Plan backs fabric and clean heat — check eligibility alongside tariff moves.`
  const capLeadHome = [capLead, unitLead, warmHomesLead, ...policySavings.map((p) => p.reason)]
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'energy saving trust uk (2026 factors)',
    explanation: capLeadHome,
    policySavings: policySavings.length > 0 ? policySavings : undefined,
    unitRateSource,
    unitRatesPence: { elec: elecPence, gas: gasPence },
    claimOfferUrl: hasLeakOpportunity ? 'https://octopus.energy/tracker/' : null,
    insight: hasLeakOpportunity
      ? 'Your current heating profile is above the efficient regional baseline; optimise tariff and controls first.'
      : 'Your home is running efficiently.',
  }
}

function resolveHomeEnergyType(a: Record<string, string>): string {
  const raw = (a.home_power ?? a.energy_type ?? '').trim().toUpperCase()
  if (raw === 'MIX') return 'MIXED'
  return raw
}

/** Utilities tile — same bill physics as home, keyed on profile / `home_power`. */
export function calculateUtilities(
  a: Record<string, string>,
  unitRates?: {
    elecGbpPerKwh: number
    gasGbpPerKwh: number
    source?: UnitRateSource
    elecPPerKwh?: number
    gasPPerKwh?: number
  },
  gridCarbon?: GridCarbonContext
): ImpactResult {
  const energy_type = resolveHomeEnergyType(a)
  return calculateHome(
    {
      ...a,
      energy_type: energy_type || a.energy_type,
      monthly_cost: a.monthly_cost ?? a.monthly_energy_bill ?? '120',
      green_tariff: a.green_tariff ?? (a.tariff_type === 'TRACKER' ? 'YES' : 'NO'),
    },
    unitRates,
    gridCarbon
  )
}

const MILES_TO_KM = 1.60934

export function calculateTravel(
  a: Record<string, string>,
  profileTransport?: string
): ImpactResult {
  const dailyMiles = Number(a.commute_distance ?? a.distance_amount ?? 50)
  const period = (a.distance_period ?? 'WEEK') as 'WEEK' | 'MONTH'
  const milesPerYear =
    a.commute_distance != null && String(a.commute_distance).trim() !== ''
      ? dailyMiles * 250
      : period === 'MONTH'
        ? dailyMiles * 12
        : dailyMiles * 52
  const kmPerYear = milesPerYear * MILES_TO_KM
  const evHybrid = String(a.ev_hybrid ?? a.fuel_type ?? '').toUpperCase()
  const isPetrol =
    evHybrid === 'PETROL_DIESEL' ||
    (a.fuel_type === 'PETROL' || (a.primary_transport === 'CAR' && a.fuel_type !== 'ELECTRIC' && a.fuel_type !== 'HYBRID'))
  const isDiesel = a.fuel_type === 'DIESEL' || evHybrid === 'PETROL_DIESEL'
  const isEv = evHybrid === 'EV' || evHybrid === 'HYBRID' || a.fuel_type === 'ELECTRIC' || a.fuel_type === 'HYBRID'
  const mode = a.primary_transport || profileTransport || 'CAR'
  let carbon = 0
  let money = 0
  if (isPetrol) {
    carbon = petrolCarbon2026(kmPerYear)
    const litresPerYear = kmPerYear / 10
    const annualCost = petrolCost2026(litresPerYear)
    money = Math.round(annualCost * 0.2)
  } else if (isDiesel) {
    carbon = Math.round(kmPerYear * 0.447)
    money = 300
  } else if (isEv) {
    carbon = Math.round(kmPerYear * 0.05)
    money = 0
  } else if (a.primary_transport === 'CAR') {
    carbon = petrolCarbon2026(kmPerYear)
    money = 300
  }
  const ozevLine = `OZEV £${TRUTH_2026_MARCH.EV_GRANT_NEW_GBP} chargepoint grant (flats & renters) from 1 Apr 2026 — £500 per socket (was £350).`
  const travelExplain =
    isEv || a.fuel_type === 'HYBRID'
      ? [
          ozevLine,
          'your ev or hybrid runs at ~4p/mile versus 18p/mile for petrol at april 2026 fuel prices — the gap widens further as smart overnight charging drops below the peak rate.',
          'home chargepoint installation takes one half-day — claim the ozev grant before you book, as installer slots fill 6–8 weeks ahead.',
        ]
      : isPetrol || isDiesel
        ? [
            'petrol and diesel commuting at uk averages costs £1,400–£2,200/yr in fuel alone — switching one 10-mile round trip per week to rail cuts ~120 kg co₂e and often the same in cash.',
            'one day per week remote removes 20% of your annual commute footprint without hardware or kit changes.',
            'the defra transport emission factor for petrol is 0.165 kg co₂e per km — every 6 km you avoid saves 1 kg.',
          ]
        : [
            'your transport pattern already sits below the uk car-commuter average — every trip not made by car avoids 0.165 kg co₂e per km.',
            'bus and train travel emits 5–10x less per passenger km than a solo petrol car — rail is cheaper than fuel once you account for parking.',
          ]
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.max(0, money),
    source: 'defra transport factors (2026 petrol)',
    explanation: travelExplain,
    claimOfferUrl: isEv || a.fuel_type === 'HYBRID' ? 'https://www.gov.uk/zero-emission-vehicle-grants' : undefined,
    insight: mode === 'CAR' || isPetrol || isDiesel ? 'Switching to an EV could save you £1,400/yr.' : 'Your commute is high-value.',
  }
}

export function calculateFood(a: Record<string, string>): ImpactResult {
  const diet = String(a.diet_profile ?? a.diet_type ?? '').toUpperCase()
  const carbon =
    diet === 'PLANT_BASED' || diet === 'VEGAN'
      ? 800
      : diet === 'VEGETARIAN'
        ? 1100
        : diet === 'FLEXI'
          ? 1400
          : 1800
  const organic = String(a.organic_shopping ?? a.food_waste ?? '').toUpperCase()
  const money = organic === 'HIGH' ? 280 : organic === 'SOME' || organic === 'MEDIUM' ? 150 : 80
  // own_produce saving not yet in profile questions — map when added
  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'wrap uk',
    explanation: [
      'diet is the largest controllable carbon lever in a uk household — a meat-heavy diet runs ~1,800 kg/yr versus 800 kg for plant-based at wrap uk averages.',
      'two meat-free meals per week drops annual food carbon by ~300 kg — no income penalty, no calorie change, no equipment.',
      'organic and local produce cuts embedded transport and synthetic nitrogen emissions — pair with a weekly meal plan to stop buying what you discard.',
    ],
  }
}

export function calculateShopping(a: Record<string, string>): ImpactResult {
  // Map profile question keys: retail_channel, repair_mindset, online_deliveries
  const channel = String(a.retail_channel ?? a.buy_new ?? '').toUpperCase()
  const repair = String(a.repair_mindset ?? '').toUpperCase()
  const deliveries = String(a.online_deliveries ?? '').toUpperCase()

  const isSecondHand = channel === 'SECOND_HAND'
  const isMixed = channel === 'MIXED'
  const repairsFirst = repair === 'REPAIR_FIRST'
  const highDeliveries = deliveries === 'DAILY' || deliveries === 'WEEKLY'

  // Default £200/month non-food discretionary (UK average — WRAP)
  const monthly = Number(a.monthly_spend ?? 200)
  const annualSpend = monthly * 12

  // Carbon: new goods embed ~2.5 kg CO₂e per £ (WRAP UK lifecycle average)
  const carbonMultiplier = isSecondHand ? 0.4 : isMixed ? 0.7 : 1.0
  const carbonKg = Math.round(Math.max(0, annualSpend * 2.5 * carbonMultiplier))

  // Money: circular economy saving stack
  let moneyGbp = 0
  if (!isSecondHand) moneyGbp += Math.round(annualSpend * 0.15) // second-hand saves ~15% avg
  if (!repairsFirst) moneyGbp += Math.round(annualSpend * 0.07) // repair vs replace saving
  if (highDeliveries) moneyGbp += 80 // delivery consolidation saves £80+/yr

  return {
    carbonKg,
    moneyGbp: Math.max(0, moneyGbp),
    source: 'wrap uk',
    explanation: [
      'new goods embed ~2.5 kg co₂e per £ spent across their full lifecycle — buying second-hand cuts that carbon by 60% and the cost by 30–70%.',
      'uk households spend ~£2,400/yr on non-food discretionary items — repairing instead of replacing extends product life and removes manufacturing carbon from your footprint.',
      'consolidating weekly online deliveries into one slot cuts last-mile van emissions — daily delivery runs generate 4x the carbon of a single weekly collection.',
    ],
  }
}

export function calculateMoney(a: Record<string, string>): ImpactResult {
  // Map profile question keys: monthly_energy_bill, tariff_type, green_investments
  const greenInvestments = String(a.green_investments ?? '').toUpperCase()
  const tariff = String(a.tariff_type ?? '').toUpperCase()
  const monthlyBill = Number(a.monthly_energy_bill ?? 0)

  let money = 0

  // April 2026 green levy shift — £150 off dual-fuel bills
  money += TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP

  // Green investment potential
  if (greenInvestments === 'HIGH') money += 300
  else if (greenInvestments === 'SOME') money += 150
  else money += 60

  // Tariff optimisation headroom
  if (tariff === 'VARIABLE' || tariff === 'UNKNOWN') money += 120
  else if (tariff === 'FIXED') money += 40

  // Monthly bill → switching saving (8% at uk averages)
  if (monthlyBill > 0) {
    money += Math.round(monthlyBill * 12 * 0.08)
  } else {
    money += 80 // default switching saving
  }

  return {
    carbonKg: 0,
    moneyGbp: Math.max(0, money),
    source: 'ofgem + gov.uk',
    explanation: [
      `green levies moved off dual-fuel bills from april 2026 — £${TRUTH_2026_MARCH.GREEN_LEVY_SAVING_GBP} off the typical household cap before any switching or green investment move.`,
      'a variable or unknown tariff is the highest-risk position heading into the next ofgem window — locking into a fixed below the april £1,641 cap sets your cost floor.',
      'ethical current accounts, isas, and pension switches earn market-rate returns without funding fossil extraction — no income penalty for moving your cash.',
    ],
    claimOfferUrl: 'https://www.gov.uk/the-warm-home-discount-scheme',
  }
}

export function calculateCarbon(a: Record<string, string>): ImpactResult {
  // Map profile question keys: footprint_awareness, carbon_removal, tonne_reduction_timeline
  const awareness = String(a.footprint_awareness ?? a.tracking ?? '').toUpperCase()
  const removal = String(a.carbon_removal ?? '').toUpperCase()
  const timeline = String(a.tonne_reduction_timeline ?? '').toUpperCase()

  // Carbon gap: unknown or rough footprint = untracked waste above baseline
  const carbonKg = awareness === 'NO' ? 300 : awareness === 'ROUGH' ? 150 : 80

  // Money: removal schemes and precision tracking tools
  let moneyGbp = 0
  if (removal === 'HIGH') moneyGbp = 140
  else if (removal === 'SOME') moneyGbp = 80
  if (timeline === 'THIS_YEAR') moneyGbp += 60
  else if (timeline === 'ONE_TO_THREE') moneyGbp += 30

  return {
    carbonKg,
    moneyGbp,
    source: 'carbon trust uk',
    explanation: [
      'the uk domestic baseline is 12,000 kwh and 1 tonne co₂e per year — most households run 1.5–2.5x that before transport is added.',
      'tracking your three largest energy habits for 30 days — heating, driving, flying — locates where 80% of your footprint actually lives.',
      'carbon removal is not the same as offsetting — gold standard biochar and direct air capture remove co₂ already in the atmosphere; offsets only prevent future emissions elsewhere.',
    ],
    claimOfferUrl: removal !== 'NONE' && removal !== '' ? 'https://www.goldstandard.org/take-action/offset-your-emissions' : undefined,
  }
}

export function calculateSolar(a: Record<string, string>): ImpactResult {
  const orient = String(a.roof_orientation ?? '').toUpperCase()
  const shade = String(a.roof_shading ?? '').toUpperCase()
  const occ = String(a.daytime_occupancy ?? '').toUpperCase()
  let moneyGbp = orient === 'SOUTH' ? 1400 : orient === 'MIXED' || orient === 'FLAT' ? 900 : 1100
  if (shade === 'NONE') moneyGbp = Math.round(moneyGbp * 1.1)
  if (shade === 'BOTH' || shade === 'TREES') moneyGbp = Math.round(moneyGbp * 0.75)
  if (occ === 'HIGH') moneyGbp = Math.round(moneyGbp * 1.12)
  const carbonKg = Math.round(moneyGbp * 0.55)
  return {
    carbonKg,
    moneyGbp,
    source: 'mcs solar uk',
    explanation: [
      'a south-facing, unshaded 4kw system generates ~3,800 kwh/yr at uk averages — against the 12,000 kwh baseline that is 32% of your annual draw before smart export.',
      'daytime self-consumption is where solar earns most — running dishwasher and washing machine at noon, or charging an ev, tightens payback to 6–8 years.',
      'the smart export guarantee pays for every kwh you push to the grid — at octopus 15p/kwh export rate, a full system earns £250–400/yr on top of import savings.',
    ],
  }
}

export function calculateWater(a: Record<string, string>): ImpactResult {
  const garden = String(a.garden_butt ?? '').toUpperCase()
  const wash = String(a.wash_preference ?? '').toUpperCase()
  const rain = String(a.rainwater_harvest ?? '').toUpperCase()
  let moneyGbp = wash === 'BATH' ? 180 : wash === 'BOTH' ? 120 : 80
  if (garden === 'LARGE') moneyGbp += 60
  if (rain === 'YES') moneyGbp += 90
  const carbonKg = Math.round(moneyGbp * 1.4)
  return {
    carbonKg,
    moneyGbp,
    source: 'waterwise uk',
    explanation: [
      'heating water is the second-largest energy draw in most uk homes — switching from baths to showers cuts hot-water demand by up to 40% at no cost.',
      'a water butt cuts mains garden use by 50–70 litres per watering session in summer — large gardens see the biggest payback on water bills and pump energy.',
      'aerators on taps and showerheads cost under £10 each and cut water flow by 30% without changing pressure — fastest return on any water measure.',
    ],
  }
}

export function calculateTech(a: Record<string, string>): ImpactResult {
  const thermo = String(a.smart_thermostat ?? a.upgrade_often ?? '').toUpperCase()
  const smart = String(a.smart_home ?? '').toUpperCase()
  const meter = String(a.smart_meter ?? '').toUpperCase()
  let moneyGbp = 0
  let carbonKg = 0
  if (thermo === 'YES' || thermo === 'YEARLY') {
    moneyGbp += 140
    carbonKg += 120
  } else if (thermo === 'PLANNED') {
    moneyGbp += 60
    carbonKg += 50
  }
  if (smart === 'YES' || smart === 'PARTIAL') {
    moneyGbp += 80
    carbonKg += 70
  }
  if (meter === 'NO') {
    moneyGbp += 40
    carbonKg += 35
  }
  return {
    carbonKg,
    moneyGbp,
    source: 'uk tech emissions',
    explanation: [
      'a smart thermostat cuts heating by 10–15% on average — programme down by 1°c and save ~£80/yr at april 2026 gas rates of 5.74p/kwh.',
      'smart plugs on always-on devices cut standby draw — uk households waste £35–60/yr on standby across tv, router, and gaming kit left in standby.',
      'a smart meter ends estimated billing and shows real-time cost — users who can see spend in-app reduce usage by ~3% without any other behaviour change.',
    ],
  }
}

export function calculateWaste(a: Record<string, string>): ImpactResult {
  const collection = String(a.food_waste_collection ?? a.recycle ?? '').toUpperCase()
  const compost = String(a.composting ?? a.compost ?? '').toUpperCase()
  const soft = String(a.soft_plastics ?? '').toUpperCase()
  const carbon =
    collection === 'NO' || collection === 'NEVER' ? 350 : collection === 'PARTIAL' || collection === 'SOMETIMES' ? 175 : 80
  let moneyGbp = compost === 'NO' ? 100 : compost === 'SHARED' ? 60 : 30
  if (soft === 'NEVER') moneyGbp += 40
  return {
    carbonKg: carbon,
    moneyGbp,
    source: 'wrap uk',
    explanation: [
      'food waste is responsible for ~8% of global greenhouse gases — the average uk household throws away £700 of food per year, most of it avoidable.',
      'composting diverts wet organic waste from landfill, where it releases methane at 25x the global warming impact of co₂ over 100 years.',
      'soft plastic collection has expanded to most uk supermarkets — separate carrier bags and film from your kerbside bin to stop it going to energy-from-waste incineration.',
    ],
  }
}

export function calculateHolidays(a: Record<string, string>): ImpactResult {
  const flights = String(a.annual_flights ?? a.fly_frequency ?? '').toUpperCase()
  const duration = String(a.flight_duration ?? a.long_haul ?? '').toUpperCase()
  const hasOffsets = String(a.carbon_offsets ?? '').toUpperCase() === 'YES'
  const carbon =
    flights === 'THREE_PLUS' || flights === 'OFTEN'
      ? 2200
      : flights === 'ONE_TWO' || flights === 'YEARLY'
        ? 1100
        : 0

  // No flights — return £0 (not £120 minimum)
  if (carbon === 0) {
    return {
      carbonKg: 0,
      moneyGbp: 0,
      source: 'defra aviation factors',
      explanation: [
        'no flights this year — your holiday carbon sits in the lowest uk bracket already.',
        'train travel within the uk and europe emits 5–10x less per passenger than the equivalent short-haul flight and often costs less booked 8–12 weeks ahead.',
        'if you do fly next year, economy class over business cuts your per-seat carbon by ~3x — seat count drives each passenger share of the aircraft total.',
      ],
    }
  }

  let moneyGbp = duration === 'LONG_HAUL' || duration === 'YES' ? 320 : duration === 'MEDIUM' ? 200 : 120
  if (hasOffsets) moneyGbp = Math.round(moneyGbp * 0.85)

  return {
    carbonKg: carbon,
    moneyGbp,
    source: 'defra aviation factors',
    explanation: [
      'one long-haul return flight adds ~2.0 tonnes co₂e — that doubles the 1-tonne annual domestic baseline in a single trip.',
      'switching one short-haul flight to eurostar cuts that journey carbon by 90% and often matches door-to-door time from central london to paris or amsterdam.',
      'gold standard and verra-verified removal credits are the highest-integrity offset available — but they do not substitute for fewer flights, only partially balance what you cannot avoid.',
    ],
  }
}

export interface GeneralProfile {
  household?: string
  home_type?: string
  transport_baseline?: string
}

export function calculateGeneralHomeLiving(profile: GeneralProfile | undefined): ImpactResult {
  if (!profile?.household && !profile?.home_type) {
    return { carbonKg: 0, moneyGbp: 0, source: 'uk government data', explanation: ['Tell us who you live with and your home type.'] }
  }
  const isHouse = profile.home_type === 'HOUSE'
  const isFamily = profile.household === 'FAMILY'
  const isAlone = profile.household === 'ALONE'
  let carbon = isHouse ? 400 : 250
  if (isFamily) carbon += 150
  if (isAlone) carbon = Math.round(carbon * 0.6)
  const money = isHouse ? 180 : 120
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'energy saving trust uk',
    explanation: ['Home energy is a big part of UK household carbon.'],
  }
}

export function calculateGeneralTransport(profile: GeneralProfile | undefined): ImpactResult {
  if (!profile?.transport_baseline) {
    return { carbonKg: 0, moneyGbp: 0, source: 'uk government data', explanation: ['Tell us how you get around.'] }
  }
  const t = profile.transport_baseline.toUpperCase()
  let carbon = 0, money = 0
  if (t === 'CAR') { carbon = 600; money = 300 }
  else if (t === 'MIX') { carbon = 200; money = 100 }
  else if (t === 'PUBLIC') { carbon = 50 }
  else if (t === 'WALK' || t === 'BIKE') { carbon = 0; money = 0 }
  else { carbon = 150; money = 80 }
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'defra transport factors',
    explanation: ['Small changes to how you get around can reduce your travel footprint.'],
  }
}

export function calculateGeneralHomeExtra(profile: GeneralProfile | undefined): ImpactResult {
  if (!profile?.household && !profile?.home_type) {
    return { carbonKg: 0, moneyGbp: 0, source: 'uk government data', explanation: ['Tell us who you live with and your home type.'] }
  }
  const isHouse = profile.home_type === 'HOUSE'
  const isFamily = profile.household === 'FAMILY'
  let carbon = isHouse ? 280 : 180
  if (isFamily) carbon += 100
  const money = isHouse ? 140 : 90
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'energy saving trust uk',
    explanation: ['UK households can often save by reviewing bills and switching tariffs.'],
  }
}

/**
 * Discovery Engine — UK benchmark £ lead for Solo Focus RESULT (March 2026 baselines).
 * Uses MARCH_2026_ECONOMY / price-cap constants; labels are plain English for "UK average saving for {label}".
 */
export function ukAverageSavingForDiscoveryAnswer(
  journeyId: JourneyId,
  questionId: string,
  answerRaw: string
): { gbp: number; answerLabel: string } {
  const a = answerRaw.toUpperCase().trim()
  const labelFrom = (s: string) => s.toLowerCase().replace(/_/g, ' ')

  if (
    (journeyId === 'home' && questionId === 'energy_type') ||
    (journeyId === 'utilities' && questionId === 'home_power')
  ) {
    if (a === 'GAS')
      return { gbp: MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP, answerLabel: 'gas heating' }
    if (a === 'ELECTRIC')
      return { gbp: PRICE_CAP_SAVING_APRIL_1, answerLabel: 'electric heating' }
    if (a === 'MIX' || a === 'MIXED')
      return { gbp: 420, answerLabel: 'dual-fuel heating' }
    if (a === 'WOOD')
      return { gbp: 420, answerLabel: labelFrom(a) + ' heating' }
    if (a === 'SOLAR') return { gbp: 380, answerLabel: 'solar-assisted heating' }
    if (a === 'OTHER') return { gbp: PRICE_CAP_SAVING_APRIL_1, answerLabel: 'your heating setup' }
    return { gbp: PRICE_CAP_SAVING_APRIL_1, answerLabel: 'your heating setup' }
  }

  if (journeyId === 'travel' && questionId === 'primary_transport') {
    if (a === 'CAR') return { gbp: 1400, answerLabel: 'commuting by car' }
    if (a === 'BUS' || a === 'TRAIN') return { gbp: 220, answerLabel: 'public transport' }
    if (a === 'BIKE' || a === 'WALK') return { gbp: 0, answerLabel: 'active travel' }
    return { gbp: 180, answerLabel: 'your commute pattern' }
  }

  if (journeyId === 'travel' && questionId === 'fuel_type') {
    if (a === 'PETROL' || a === 'DIESEL') return { gbp: 900, answerLabel: labelFrom(a) + ' fuel' }
    if (a === 'ELECTRIC' || a === 'HYBRID') return { gbp: 350, answerLabel: labelFrom(a).replace('electric', 'ev') }
    return { gbp: 400, answerLabel: 'your fuel type' }
  }

  if (journeyId === 'food' && questionId === 'diet_type') {
    if (a === 'VEGAN') return { gbp: 180, answerLabel: 'a vegan diet' }
    if (a === 'VEGETARIAN') return { gbp: 140, answerLabel: 'a vegetarian diet' }
    if (a === 'FLEXI') return { gbp: 200, answerLabel: 'a flexitarian diet' }
    return { gbp: 160, answerLabel: 'an omnivore diet' }
  }

  return { gbp: PRICE_CAP_SAVING_APRIL_1, answerLabel: labelFrom(a || 'your answer') }
}

/** Rough annual kg CO₂ for injected tip card data (same journey calculators, minimal answers). */
export function estimateDiscoveryCarbonKg(
  journeyId: JourneyId,
  questionId: string,
  answerRaw: string
): number {
  const a = answerRaw.toUpperCase().trim()
  try {
    if (journeyId === 'home' && questionId === 'energy_type') {
      return calculateHome({
        energy_type: a === 'MIX' ? 'MIXED' : a,
        monthly_cost: '120',
        green_tariff: 'NO',
      }).carbonKg
    }
    if (journeyId === 'utilities' && questionId === 'home_power') {
      return calculateUtilities({
        home_power: a,
        monthly_cost: '120',
        green_tariff: 'NO',
      }).carbonKg
    }
    if (journeyId === 'travel' && questionId === 'primary_transport') {
      if (a === 'BUS' || a === 'TRAIN') return 320
      if (a === 'BIKE' || a === 'WALK') return 40
      return calculateTravel(
        {
          primary_transport: a,
          fuel_type: a === 'CAR' ? 'PETROL' : 'NONE',
          distance_amount: '40',
          distance_period: 'WEEK',
        },
        a
      ).carbonKg
    }
    if (journeyId === 'travel' && questionId === 'fuel_type') {
      return calculateTravel(
        {
          primary_transport: 'CAR',
          fuel_type: a,
          distance_amount: '50',
          distance_period: 'WEEK',
        },
        'CAR'
      ).carbonKg
    }
    if (journeyId === 'food' && questionId === 'diet_type') {
      return calculateFood({ diet_type: a, food_waste: 'MEDIUM' }).carbonKg
    }
  } catch {
    // fall through
  }
  return 450
}

/**
 * Employment “master switch” — tilts money/carbon emphasis and adds lifestyle-architect copy.
 */
export function applyEmploymentFinancialPhysics(
  result: ImpactResult,
  employment: EmploymentStatus | undefined,
  journeyKey: JourneyId
): ImpactResult {
  if (!employment) return result
  let moneyGbp = result.moneyGbp
  const extra: string[] = []

  switch (employment) {
    case 'BETWEEN_JOBS':
      if (journeyKey === 'home' || journeyKey === 'waste' || journeyKey === 'food') {
        moneyGbp = Math.round(moneyGbp * 1.04)
      }
      extra.push(
        'Between jobs: zero-upfront habits first — cooler washes, radiator tweaks, fridge eco mode.'
      )
      extra.push(
        'Ask your supplier about hardship tariffs and council cost-of-living help where relevant.'
      )
      break
    case 'STUDENT':
      if (journeyKey === 'food' || journeyKey === 'tech' || journeyKey === 'shopping') {
        moneyGbp = Math.round(moneyGbp * 1.05)
      }
      extra.push(
        'Student: shared-bill wins — batch cooking, standby off, shorter hot washes, split meter reads fairly.'
      )
      break
    case 'EMPLOYED':
      if (journeyKey === 'travel' || journeyKey === 'money') {
        moneyGbp = Math.round(moneyGbp * 1.05)
      }
      extra.push(
        'Employed: salary sacrifice (cycles, EVs where offered) and workplace perks stack with tariff wins — check payroll in 2026.'
      )
      break
    default:
      break
  }

  return {
    ...result,
    moneyGbp: Math.max(0, moneyGbp),
    explanation: [...(result.explanation ?? []), ...extra],
  }
}
