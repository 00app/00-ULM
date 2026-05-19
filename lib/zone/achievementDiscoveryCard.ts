import type { JourneyId } from '@/lib/journeys'
import { validateInjectionCard } from '@/lib/zone/injections'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import { zoneCardHeadlineFromRaw } from '@/lib/soloFocusCopy'
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
  const journeyFallback = `${params.journeyId.replace(/-/g, ' ').toUpperCase()} SAVING`
  const title = zoneCardHeadlineFromRaw(params.title, journeyFallback)
  const raw = {
    id,
    title,
    journey_key: params.journeyId,
    category: params.journeyId,
    data: {
      money: formatZoneCardMoney(moneyGbp),
      carbon: formatCarbon(carbonKg),
    },
    ...(prose ? { explanation: [prose] } : {}),
    high_impact: true,
    achievement_discovery: true,
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
    delete validated.badge
    return validated
  }
  return {
    id,
    variant: 'card-compact',
    title,
    journey_key: params.journeyId,
    category: params.journeyId,
    data: {
      money: formatZoneCardMoney(moneyGbp),
      carbon: formatCarbon(carbonKg),
    },
    ...(prose ? { explanation: [prose] } : {}),
    high_impact: true,
    achievement_discovery: true,
    dominant_win: 'money',
  }
}
