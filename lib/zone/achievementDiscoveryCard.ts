import type { JourneyId } from '@/lib/journeys'
import { validateInjectionCard } from '@/lib/zone/injections'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'

/** Pink (#FF00FF) achievement card — server + client safe. */
export function buildAchievementDiscoveryCard(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  title: string
  body?: string | null
  offerUrl?: string | null
}): ZoneTipCard {
  const moneyGbp = ukAverageSavingForDiscoveryAnswer(
    params.journeyId,
    params.questionId,
    params.answerValue
  ).gbp
  const carbonKg = Math.max(
    50,
    Math.round(estimateDiscoveryCarbonKg(params.journeyId, params.questionId, params.answerValue))
  )
  const id = buildDiscoveryInjectionId(params.journeyId, params.questionId, params.answerValue)
  const url = params.offerUrl?.trim().startsWith('http') ? params.offerUrl.trim() : undefined
  const prose = typeof params.body === 'string' ? params.body.trim() : ''
  const raw = {
    id,
    title: params.title,
    journey_key: params.journeyId,
    category: params.journeyId,
    data: {
      money: formatZoneCardMoney(moneyGbp),
      carbon: formatCarbon(carbonKg),
    },
    ...(prose ? { explanation: [prose] } : {}),
    high_impact: true,
    achievement_discovery: true,
    badge: 'NEW DISCOVERY',
    dominant_win: 'money' as const,
    ...(url
      ? {
          source: url,
          cta: { label: 'GET THIS SHIFT', url },
          actions: { actionType: 'learn' as const, learnUrl: url, actionUrl: url },
        }
      : {}),
  }
  const validated = validateInjectionCard(raw)
  if (validated) {
    validated.achievement_discovery = true
    validated.high_impact = true
    validated.badge = 'NEW DISCOVERY'
    return validated
  }
  return {
    id,
    variant: 'card-compact',
    title: params.title,
    journey_key: params.journeyId,
    category: params.journeyId,
    data: {
      money: formatZoneCardMoney(moneyGbp),
      carbon: formatCarbon(carbonKg),
    },
    ...(prose ? { explanation: [prose] } : {}),
    high_impact: true,
    achievement_discovery: true,
    badge: 'NEW DISCOVERY',
    dominant_win: 'money',
  }
}
