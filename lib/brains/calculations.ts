/**
 * ZERO ZERO — Impact calculations (UK annualized).
 *
 * Scraped variable hook: these functions return the baseline impact.
 * Real-time scraped data (001 Scraper) is applied in buildUserImpact via
 * lib/brains/scrapedOverlay.ts with ≤20% delta validation; impact scores
 * update automatically when options.scraped is provided.
 */
export interface ImpactResult {
  carbonKg: number
  moneyGbp: number
  source: string
  explanation: string[]
}

export function calculateHome(a: Record<string, string>): ImpactResult {
  const monthly = Number(a.monthly_cost ?? 120)
  const annualSpend = monthly * 12
  let carbon = annualSpend * 0.45
  let money = 0
  if (a.green_tariff === 'NO') money += 120
  if (
    a.green_tariff === 'NO' &&
    ((a.electricity_provider && a.electricity_provider !== 'OCTOPUS') ||
      (a.gas_provider && a.gas_provider !== 'OCTOPUS'))
  ) {
    carbon += 400
    money += 180
  }
  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source: 'energy saving trust uk',
    explanation: ['Home energy is a big part of UK household carbon.'],
  }
}

export function calculateTravel(a: Record<string, string>): ImpactResult {
  const amount = Number(a.distance_amount ?? 50)
  const period = (a.distance_period ?? 'WEEK') as 'WEEK' | 'MONTH'
  const milesPerYear = period === 'MONTH' ? amount * 12 : amount * 52
  let factor = 0
  if (a.fuel_type === 'PETROL') factor = 0.404
  else if (a.fuel_type === 'DIESEL') factor = 0.447
  else if (a.fuel_type === 'ELECTRIC' || a.fuel_type === 'HYBRID') factor = 0.05
  else if (a.fuel_type === 'NONE') factor = 0
  else if (a.primary_transport === 'CAR') factor = 0.404
  const carbon = Math.round(Math.max(0, milesPerYear * factor))
  const money = a.primary_transport === 'CAR' ? 300 : 0
  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'defra transport factors',
    explanation: ['How you get around shapes your carbon.'],
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
