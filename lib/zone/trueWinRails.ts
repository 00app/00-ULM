import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import type { ZoneTipCard } from '@/lib/logic/zone'
import type { JourneyId } from '@/lib/journeys'
import { TRUTH_2026_JULY, MARCH_2026_ECONOMY } from '@/lib/brains/constants'

export const TRUE_WIN_RAILS = {
  energyCapGbp: TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP,
  avgTariffPencePerKwh: 21.9,
  boilerGrantGbp: MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP,
} as const

function parseMoney(value: string): number | null {
  const n = Number.parseFloat(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseCarbon(value: string): number | null {
  const n = Number.parseFloat(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function fallbackValues(journey: JourneyId): { money: string; carbon: string } {
  const d = UK_2026_MONEY_LEAD[journey]
  return {
    money: d?.money_lead?.startsWith('£') ? d.money_lead : `£${Math.round(d?.money_value ?? 0)}`,
    carbon: `${Math.round(d?.carbon_value ?? 0)} kg CO₂`,
  }
}

function trimHeadline(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
    .trim()
}

export function enforceTrueWinRails(card: ZoneTipCard): ZoneTipCard {
  const moneyNum = parseMoney(card.data.money ?? '')
  const carbonNum = parseCarbon(card.data.carbon ?? '')
  const ambiguous = moneyNum == null || carbonNum == null || moneyNum <= 0 || carbonNum < 0
  const fallback = fallbackValues(card.journey_key)

  const next: ZoneTipCard = {
    ...card,
    title: trimHeadline(card.title),
    data: ambiguous ? fallback : card.data,
    explanation:
      card.explanation && card.explanation.length > 0
        ? card.explanation
        : [
            `validated on March 2026 rails: £${TRUE_WIN_RAILS.energyCapGbp} cap, ${TRUE_WIN_RAILS.avgTariffPencePerKwh}p/kWh average tariff.`,
          ],
  }
  return next
}

export function passesBoundaryGuard(card: ZoneTipCard, postcode: string | null): boolean {
  if (card.type === 'LocalTip' && !postcode) return false
  const moneyNum = parseMoney(card.data.money ?? '')
  const carbonNum = parseCarbon(card.data.carbon ?? '')
  if (moneyNum == null || carbonNum == null) return false
  if (moneyNum > 100000) return false
  if (carbonNum > 100000) return false
  if (!card.title.trim()) return false
  return true
}

export function validateAndRailCards(cards: ZoneTipCard[], postcode: string | null): ZoneTipCard[] {
  return cards
    .map((c) => enforceTrueWinRails(c))
    .filter((c) => passesBoundaryGuard(c, postcode))
}
