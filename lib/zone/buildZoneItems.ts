// ❌ DEPRECATED — DO NOT USE
// Replaced by lib/zone/buildZoneViewModel.ts
// Zone cards MUST come from buildZoneViewModel.ts only

import { JourneyId } from '@/lib/journeys'
import {
  calculateHome,
  calculateTravel,
  calculateFood,
  calculateShopping,
  calculateMoney,
  calculateCarbon,
  calculateTech,
  calculateWaste,
  calculateHolidays,
  type ImpactResult,
} from '@/lib/brains/calculations'

export interface ZoneCardData {
  journey: JourneyId
  title: string
  carbon: number
  money: number
  source: string
}

export function buildZoneFromAnswers(
  allAnswers: Record<JourneyId, Record<string, string>>
): ZoneCardData[] {
  const results: ZoneCardData[] = []

  // Home
  if (allAnswers.home) {
    const r = calculateHome(allAnswers.home)
    results.push({
      journey: 'home',
      title: 'reduce home energy costs',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Travel
  if (allAnswers.travel) {
    const r = calculateTravel(allAnswers.travel)
    results.push({
      journey: 'travel',
      title: 'cut transport emissions',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Food
  if (allAnswers.food) {
    const r = calculateFood(allAnswers.food)
    results.push({
      journey: 'food',
      title: 'reduce food waste',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Shopping
  if (allAnswers.shopping) {
    const r = calculateShopping(allAnswers.shopping)
    results.push({
      journey: 'shopping',
      title: 'shop more sustainably',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Money
  if (allAnswers.money) {
    const r = calculateMoney(allAnswers.money)
    results.push({
      journey: 'money',
      title: 'save on household costs',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Carbon
  if (allAnswers.carbon) {
    const r = calculateCarbon(allAnswers.carbon)
    results.push({
      journey: 'carbon',
      title: 'track your footprint',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Tech
  if (allAnswers.tech) {
    const r = calculateTech(allAnswers.tech)
    results.push({
      journey: 'tech',
      title: 'extend device life',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Waste
  if (allAnswers.waste) {
    const r = calculateWaste(allAnswers.waste)
    results.push({
      journey: 'waste',
      title: 'reduce waste',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  // Holidays
  if (allAnswers.holidays) {
    const r = calculateHolidays(allAnswers.holidays)
    results.push({
      journey: 'holidays',
      title: 'travel more sustainably',
      carbon: r.carbonKg,
      money: r.moneyGbp,
      source: r.source,
    })
  }

  return results
}
