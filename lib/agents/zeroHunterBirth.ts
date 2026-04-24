/**
 * ZeroHunter — card birth when the main discovery pipeline misses (timeout / no Gemini).
 * Uses Firecrawl-backed {@link researchLocalGrantsToDiscovery} + validated Zone injection shape.
 */

import type { JourneyId } from '@/lib/journeys'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { validateInjectionCard } from '@/lib/zone/injections'
import { buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import { researchLocalGrantsToDiscovery } from '@/lib/agents/skills/researchLocalGrants'
import type { DiscoveryCard } from '@/lib/types/discovery'
import { discoveryCardFromZoneTip } from '@/lib/types/discovery'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'

export async function runZeroHunterBirthAfterAnswer(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null
}): Promise<{ discoveryCard: DiscoveryCard; zoneCard: ZoneTipCard } | null> {
  const { journeyId, questionId, answerValue, postcode } = params
  const pc = postcode?.replace(/\s+/g, '').trim() ?? ''

  if (journeyId === 'home' && questionId === 'energy_type' && answerValue.trim().toUpperCase() === 'GAS') {
    const parsed = await researchLocalGrantsToDiscovery(pc, 'Heat Pump Grant')
    const rec = getDiscoveryRecommendation('home', 'energy_type', 'GAS')
    const id = buildDiscoveryInjectionId('home', 'energy_type', answerValue)
    const zoneCard = validateInjectionCard({
      id,
      title: parsed.title,
      journey_key: 'home',
      category: 'home',
      data: { money: parsed.valueMoneyStr, carbon: parsed.carbonStr },
      source: parsed.source_url,
      explanation: [parsed.description],
      actions: {
        actionType: 'learn',
        learnUrl: parsed.source_url,
        actionUrl: parsed.source_url,
      },
      cta: { label: 'Check eligibility', url: parsed.source_url },
      ...(rec.followUp ? { followUp: rec.followUp } : {}),
    })
    if (!zoneCard) return null
    return { zoneCard, discoveryCard: discoveryCardFromZoneTip(zoneCard) }
  }

  return null
}
