/**
 * ZERO ZERO — LOCKED CALCULATION ENGINE
 * 
 * SINGLE SOURCE OF TRUTH for all carbon and money calculations.
 * 
 * RULES:
 * - ALL calculations MUST come from this file ONLY
 * - Annual values only (kg CO₂e per year, £ per year)
 * - Money is never negative (0 minimum)
 * - Carbon is never negative (0 minimum)
 * - All values rounded to whole numbers
 * - Source attribution is ALWAYS present
 * 
 * UK DATA SOURCES:
 * - Home/Energy → Energy Saving Trust UK
 * - Travel → DEFRA Transport Emissions Factors
 * - Food/Waste → WRAP UK
 * - Carbon → Carbon Trust UK
 * - Holidays → DEFRA Aviation Factors
 * - Money → UK Household Spending data
 * - Tech → UK consumer electronics lifecycle studies
 * - Shopping → UK retail emissions data
 * 
 * NO OTHER FILE MAY PERFORM CALCULATIONS.
 * NO HELPER RULES.
 * NO FALLBACKS.
 * NO INLINE MATHS.
 */

export interface ImpactResult {
  carbonKg: number
  moneyGbp: number
  source: string
  explanation: string[]  // Human, UK-based reasoning (non-technical)
}

export function calculateHome(a: Record<string, string>): ImpactResult {
  const monthly = Number(a.monthly_cost ?? 120) // UK avg fallback
  const annualSpend = monthly * 12

  let carbon = annualSpend * 0.45
  let money = 0
  let source = 'energy saving trust uk'

  // Provider logic only when answered
  if (a.green_tariff === 'NO') {
    money += 120
  }

  if (
    a.green_tariff === 'NO' &&
    ((a.electricity_provider && a.electricity_provider !== 'OCTOPUS') ||
     (a.gas_provider && a.gas_provider !== 'OCTOPUS'))
  ) {
    carbon += 400
    money += 180
    source = 'energy saving trust uk'
  }

  const explanation: string[] = []
  if (annualSpend > 0) {
    explanation.push('Your energy spend is used to estimate carbon from typical UK bills.')
  }
  if (a.green_tariff === 'NO') {
    explanation.push('Green tariffs support renewable generation and can reduce your footprint.')
  }
  if (
    a.green_tariff === 'NO' &&
    ((a.electricity_provider && a.electricity_provider !== 'OCTOPUS') ||
     (a.gas_provider && a.gas_provider !== 'OCTOPUS'))
  ) {
    explanation.push('Switching to a green tariff or a supplier like Octopus could cut carbon and often save money, based on Energy Saving Trust data.')
  }
  if (explanation.length === 0) {
    explanation.push('Home energy is a big part of UK household carbon. Small changes add up.')
  }

  return {
    carbonKg: Math.round(Math.max(0, carbon)),
    moneyGbp: Math.round(Math.max(0, money)),
    source,
    explanation,
  }
}

export function calculateTravel(a: Record<string, string>): ImpactResult {
  const amount = Number(a.distance_amount ?? 50) // UK avg ~50 miles/week
  const period = (a.distance_period ?? 'WEEK') as 'WEEK' | 'MONTH'
  const milesPerYear = period === 'MONTH' ? amount * 12 : amount * 52

  let factor = 0
  if (a.fuel_type === 'PETROL') factor = 0.404
  else if (a.fuel_type === 'DIESEL') factor = 0.447
  else if (a.fuel_type === 'ELECTRIC' || a.fuel_type === 'HYBRID') factor = 0.05
  else if (a.fuel_type === 'NONE') factor = 0
  // no fuel_type yet: assume petrol for car, else 0
  else if (a.primary_transport === 'CAR') factor = 0.404

  const carbon = Math.round(Math.max(0, milesPerYear * factor))
  const money = a.primary_transport === 'CAR' ? 300 : 0

  const explanation: string[] = []
  if (a.primary_transport === 'CAR' && factor > 0) {
    explanation.push('Car travel produces most transport emissions. UK figures from DEFRA show petrol and diesel emit more than electric or hybrid.')
  }
  if (a.primary_transport !== 'CAR') {
    explanation.push('Walking, cycling, buses and trains typically have much lower carbon than driving.')
  }
  if (money > 0) {
    explanation.push('Cutting car use can save hundreds on fuel, insurance and maintenance each year.')
  }
  if (explanation.length === 0) {
    explanation.push('How you get around shapes your carbon. Small shifts make a difference.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'defra transport factors',
    explanation,
  }
}

export function calculateFood(a: Record<string, string>): ImpactResult {
  const carbon =
    a.diet_type === 'VEGAN' ? 800 :
    a.diet_type === 'VEGETARIAN' ? 1100 :
    a.diet_type === 'FLEXI' ? 1400 : 1800 // default UK omnivore avg

  const money =
    a.food_waste === 'HIGH' ? 300 :
    a.food_waste === 'MEDIUM' ? 150 : 0

  const explanation: string[] = []
  explanation.push('UK food emissions vary a lot with what we eat. WRAP research shows plant-based choices typically lower your footprint.')
  if (money > 0) {
    explanation.push('Reducing food waste saves money and carbon. Planning meals and using leftovers helps.')
  }

  return { carbonKg: carbon, moneyGbp: money, source: 'wrap uk', explanation }
}

export function calculateShopping(a: Record<string, string>): ImpactResult {
  const monthly = Number(a.monthly_spend ?? 200) // UK avg discretionary spend
  const annualSpend = monthly * 12

  const carbon = Math.max(0, annualSpend * 2.5)
  const money =
    a.buy_new === 'OFTEN' ? Math.round(annualSpend * 0.2) :
    a.buy_new === 'SOMETIMES' ? Math.round(annualSpend * 0.1) : 0

  const explanation: string[] = []
  explanation.push('UK retail has significant embedded carbon. Buying less new stuff and choosing second-hand cuts both emissions and spending.')
  if (money > 0) {
    explanation.push('Reducing how often you buy new can save hundreds a year.')
  }

  return {
    carbonKg: Math.round(carbon),
    moneyGbp: Math.max(0, money),
    source: 'uk retail emissions',
    explanation,
  }
}

export function calculateMoney(a: Record<string, string>): ImpactResult {
  const carbon = 0
  const money =
    a.finances_tight === 'YES' ? 250 : 0

  const explanation: string[] = []
  explanation.push('Where you spend most — housing, energy, food, travel — affects both your budget and your carbon.')
  if (money > 0) {
    explanation.push('UK data shows many households can save by reviewing bills, switching tariffs and cutting waste.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'uk household spending',
    explanation,
  }
}

export function calculateCarbon(a: Record<string, string>): ImpactResult {
  const carbon =
    a.tracking === 'NO' ? 300 : 0
  const money = 0

  const explanation: string[] = []
  explanation.push('Tracking your carbon helps you see where to act. The Carbon Trust and UK government provide reliable methods.')
  if (carbon > 0) {
    explanation.push('Once you know your footprint, you can focus on the changes that matter most.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'carbon trust uk',
    explanation,
  }
}

export function calculateTech(a: Record<string, string>): ImpactResult {
  const carbon =
    a.upgrade_often === 'YES' ? 400 : 0
  const money =
    a.upgrade_often === 'YES' ? 200 : 0

  const explanation: string[] = []
  explanation.push('UK studies show that making devices last longer cuts carbon and saves cash.')
  if (carbon > 0) {
    explanation.push('Keeping phones and laptops longer, and repairing instead of replacing, really adds up.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'uk tech emissions',
    explanation,
  }
}

export function calculateWaste(a: Record<string, string>): ImpactResult {
  const carbon =
    a.recycle === 'NEVER' ? 350 :
    a.recycle === 'SOMETIMES' ? 175 : 0
  const money =
    a.compost === 'NO' ? 100 : 0

  const explanation: string[] = []
  explanation.push('Recycling and composting reduce what goes to landfill. WRAP data shows UK households can cut waste sharply.')
  if (money > 0) {
    explanation.push('Composting food scraps saves bin capacity and supports greener habits.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'wrap uk',
    explanation,
  }
}

export function calculateHolidays(a: Record<string, string>): ImpactResult {
  const carbon =
    a.fly_frequency === 'OFTEN' ? 2000 :
    a.fly_frequency === 'YEARLY' ? 1000 : 0
  const money = a.long_haul === 'YES' ? 300 : 150 // default UK short-haul avg

  const explanation: string[] = []
  explanation.push('Flying is one of the highest-carbon choices. DEFRA figures show aviation emissions add up fast.')
  explanation.push('Trains and staycations in the UK can cut your holiday footprint and often cost less.')
  if (carbon > 0) {
    explanation.push('Flying less, or going shorter haul, makes a big difference.')
  }

  return {
    carbonKg: carbon,
    moneyGbp: money,
    source: 'defra aviation factors',
    explanation,
  }
}
