/**
 * ZERO ZERO — Impact calculations (UK annualized).
 *
 * March 2026: Electricity £0.2769/kWh (MARCH_2026_ECONOMY.ELEC_UNIT_RATE) via lib/carbonCashCalculator.
 * Uses March 2026 factors from lib/carbonCashCalculator for home (elec/gas) and travel (petrol).
 * Scraped variable hook: real-time data applied in buildUserImpact via scrapedOverlay.ts.
 */
import {
  FACTORS_2026,
  electricitySaving2026,
  gasSaving2026,
  annualCarbonKg,
  petrolCarbon2026,
  petrolCost2026,
} from '@/lib/carbonCashCalculator'
import {
  MARCH_2026_ECONOMY,
  GREEN_LEVY_SHIFT_APRIL_2026_GBP,
  PRICE_CAP_APRIL_2026,
  PRICE_CAP_MARCH_2026,
  PRICE_CAP_SAVING_APRIL_1,
} from '@/lib/brains/constants'
import type { JourneyId } from '@/lib/journeys'
import type { EmploymentStatus } from '@/lib/brains/types'
import { formatZoneCardMoney } from '@/lib/format'

export { formatMoneyValue, formatCarbonValue, getMoneyStampParts, getCarbonStampParts } from '@/lib/format'

export interface ImpactResult {
  carbonKg: number
  moneyGbp: number
  source: string
  explanation: string[]
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
  unitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
): ImpactResult {
  const elecR = unitRates?.elecGbpPerKwh ?? MARCH_2026_ECONOMY.ELEC_UNIT_RATE
  const gasR = unitRates?.gasGbpPerKwh ?? MARCH_2026_ECONOMY.GAS_UNIT_RATE
  const monthly = Number(a.monthly_cost ?? 120)
  const { elecKwh, gasKwh } = annualKwhFromSpend(monthly, elecR, gasR)
  const elecPence = elecR * 100
  const gasPence = gasR * 100
  const carbonElec = annualCarbonKg(elecKwh, FACTORS_2026.ELECTRICITY_CARBON_KG_PER_KWH)
  const carbonGas = annualCarbonKg(gasKwh, FACTORS_2026.GAS_CARBON_KG_PER_KWH)
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
    const saved = electricitySaving2026(elecKwh, optElec, elecPence)
    const savedGas = gasSaving2026(gasKwh, optGas, gasPence)
    money += Math.round(saved.moneyGbp + savedGas.moneyGbp)
  }
  /** Economic truth (March 2026): April 1 cap drop — typical household automatic £117/yr (Ofgem dual-fuel story). */
  money += PRICE_CAP_SAVING_APRIL_1
  /** April 2026: green levy shift off dual-fuel bills (~£150/yr) into general taxation. */
  money += GREEN_LEVY_SHIFT_APRIL_2026_GBP
  const eligibleForGrant = a.energy_type === 'GAS'
  const capLead = `Save £${PRICE_CAP_SAVING_APRIL_1} on 1 April — typical cap ${formatZoneCardMoney(PRICE_CAP_MARCH_2026)}/yr → ${formatZoneCardMoney(PRICE_CAP_APRIL_2026)}/yr (7% fall).`
  const levyLead = `Green levy shift: ~£${GREEN_LEVY_SHIFT_APRIL_2026_GBP}/yr of policy costs move off dual-fuel bills from April 2026 — another automatic line-item win.`
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'energy saving trust uk (2026 factors)',
    explanation: [capLead, levyLead, 'Home energy is a big part of UK household carbon.'],
    claimOfferUrl: eligibleForGrant ? 'https://www.gov.uk/apply-boiler-upgrade-scheme' : null,
    insight: eligibleForGrant
      ? `You're eligible for a ${formatZoneCardMoney(MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP)} Heat Pump grant.`
      : 'Your home is running efficiently.',
  }
}

const MILES_TO_KM = 1.60934

export function calculateTravel(
  a: Record<string, string>,
  profileTransport?: string
): ImpactResult {
  const amount = Number(a.distance_amount ?? 50)
  const period = (a.distance_period ?? 'WEEK') as 'WEEK' | 'MONTH'
  const milesPerYear = period === 'MONTH' ? amount * 12 : amount * 52
  const kmPerYear = milesPerYear * MILES_TO_KM
  const isPetrol = a.fuel_type === 'PETROL' || (a.primary_transport === 'CAR' && a.fuel_type !== 'ELECTRIC' && a.fuel_type !== 'HYBRID')
  const isDiesel = a.fuel_type === 'DIESEL'
  const isEv = a.fuel_type === 'ELECTRIC' || a.fuel_type === 'HYBRID'
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
  } else if (a.primary_transport === 'CAR') {
    carbon = petrolCarbon2026(kmPerYear)
    money = 300
  }
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.max(0, money),
    source: 'defra transport factors (2026 petrol)',
    explanation: ['How you get around shapes your carbon.'],
    insight: mode === 'CAR' || isPetrol || isDiesel ? 'Switching to an EV could save you £1,400/yr.' : 'Your commute is high-value.',
  }
}

export function calculateFood(a: Record<string, string>): ImpactResult {
  const carbon =
    a.diet_type === 'VEGAN' ? 800 :
    a.diet_type === 'VEGETARIAN' ? 1100 :
    a.diet_type === 'FLEXI' ? 1400 : 1800
  const money = a.food_waste === 'HIGH' ? 300 : a.food_waste === 'MEDIUM' ? 150 : 0
  return { carbonKg: carbon, moneyGbp: money, source: 'wrap uk', explanation: ['UK food emissions vary with what we eat.'] }
}

export function calculateShopping(a: Record<string, string>): ImpactResult {
  const monthly = Number(a.monthly_spend ?? 200)
  const annualSpend = monthly * 12
  const carbon = Math.max(0, annualSpend * 2.5)
  const money =
    a.buy_new === 'OFTEN' ? Math.round(annualSpend * 0.2) :
    a.buy_new === 'SOMETIMES' ? Math.round(annualSpend * 0.1) : 0
  return {
    carbonKg: Math.round(carbon),
    moneyGbp: Math.max(0, money),
    source: 'uk retail emissions',
    explanation: ['Buying less new cuts emissions and spending.'],
  }
}

export function calculateMoney(a: Record<string, string>): ImpactResult {
  const money = a.finances_tight === 'YES' ? 250 : 0
  return { carbonKg: 0, moneyGbp: money, source: 'uk household spending', explanation: ['Where you spend most affects budget and carbon.'] }
}

export function calculateCarbon(a: Record<string, string>): ImpactResult {
  const carbon = a.tracking === 'NO' ? 300 : 0
  return { carbonKg: carbon, moneyGbp: 0, source: 'carbon trust uk', explanation: ['Tracking your carbon helps you see where to act.'] }
}

export function calculateTech(a: Record<string, string>): ImpactResult {
  const carbon = a.upgrade_often === 'YES' ? 400 : 0
  const money = a.upgrade_often === 'YES' ? 200 : 0
  return { carbonKg: carbon, moneyGbp: money, source: 'uk tech emissions', explanation: ['Making devices last longer cuts carbon and saves cash.'] }
}

export function calculateWaste(a: Record<string, string>): ImpactResult {
  const carbon = a.recycle === 'NEVER' ? 350 : a.recycle === 'SOMETIMES' ? 175 : 0
  const money = a.compost === 'NO' ? 100 : 0
  return { carbonKg: carbon, moneyGbp: money, source: 'wrap uk', explanation: ['Recycling and composting reduce landfill.'] }
}

export function calculateHolidays(a: Record<string, string>): ImpactResult {
  const carbon = a.fly_frequency === 'OFTEN' ? 2000 : a.fly_frequency === 'YEARLY' ? 1000 : 0
  const money = a.long_haul === 'YES' ? 300 : 150
  return { carbonKg: carbon, moneyGbp: money, source: 'defra aviation factors', explanation: ['Flying is one of the highest-carbon choices.'] }
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

  if (journeyId === 'home' && questionId === 'energy_type') {
    if (a === 'GAS')
      return { gbp: MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP, answerLabel: 'gas heating' }
    if (a === 'ELECTRIC')
      return { gbp: PRICE_CAP_SAVING_APRIL_1, answerLabel: 'electric heating' }
    if (a === 'WOOD' || a === 'MIXED')
      return { gbp: 420, answerLabel: labelFrom(a) + ' heating' }
    if (a === 'SOLAR') return { gbp: 380, answerLabel: 'solar-assisted heating' }
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
        energy_type: a,
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

export function normalizeEmploymentStatus(
  raw: string | undefined | null
): EmploymentStatus | undefined {
  const u = String(raw ?? '')
    .toUpperCase()
    .trim()
  if (u === 'EMPLOYED' || u === 'SELF_EMPLOYED' || u === 'UNEMPLOYED') return u
  return undefined
}

/**
 * Employment “master switch” — tilts money/carbon emphasis and adds lifestyle-architect copy.
 * Hardware & habits vs grants: unemployed → low-barrier wins; self-employed → tax context; employed → benefits / salary sacrifice.
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
    case 'UNEMPLOYED':
      if (journeyKey === 'home' || journeyKey === 'waste' || journeyKey === 'food') {
        moneyGbp = Math.round(moneyGbp * 1.04)
      }
      extra.push(
        'Low-barrier wins first: cooler washes, radiator reflectors, fridge eco mode — small £, no upfront.'
      )
      extra.push(
        'On a tight budget, ask your supplier about hardship / fuel schemes and Universal Credit cost-of-living help where relevant.'
      )
      break
    case 'SELF_EMPLOYED':
      if (journeyKey === 'home' || journeyKey === 'tech') {
        moneyGbp = Math.round(moneyGbp * 1.06)
      }
      extra.push(
        'Self-employed: a defensible share of home energy and qualifying efficiency kit may count against tax — verify with HMRC guidance and your accountant.'
      )
      break
    case 'EMPLOYED':
      if (journeyKey === 'travel' || journeyKey === 'money') {
        moneyGbp = Math.round(moneyGbp * 1.05)
      }
      extra.push(
        'Employed: salary sacrifice (cycles, EVs where offered) and workplace pension options stack with tariff and grant wins — check what payroll runs in 2026.'
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
