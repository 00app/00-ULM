import type { ZoneTipCard } from '@/lib/logic/zone'
import {
  getFlowTempSoftSave,
  getPhantomStandbySoftSave,
  scaleSoftSaveForOccupancy,
} from '@/lib/sentinel/scraper'

function trimWords(text: string, maxWords: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean)
  if (w.length <= maxWords) return w.join(' ')
  return w.slice(0, maxWords).join(' ')
}

function softSaveToZoneTip(card: ReturnType<typeof getFlowTempSoftSave>, id: string, targetField: string): ZoneTipCard {
  const scaled = scaleSoftSaveForOccupancy(card, 2)
  return {
    id,
    variant: 'card-compact',
    title: card.headline,
    journey_key: 'home',
    category: 'home',
    data: {
      money: `£${scaled.saveGbp}`,
      carbon: `${scaled.carbonKg} KG CO₂`,
    },
    explanation: [trimWords(card.description, 11)],
    sourceLabel: card.sourceLabel,
    source: card.sourceUrl,
    dominant_win: 'money',
    badge: 'sentinel',
    actions: { actionType: 'learn', learnUrl: card.sourceUrl, actionUrl: card.sourceUrl },
    followUp: {
      question: card.childQuestion,
      options: card.childOptions,
      targetField,
    },
  }
}

/** Behavioural Mother/Child sources for remote north outward codes — opens like other tips. */
export function buildRemoteBehavioralZoneTips(): ZoneTipCard[] {
  return [
    softSaveToZoneTip(getFlowTempSoftSave(), 'sentinel-behavioral-flow-temp', 'sentinel_soft_flow'),
    softSaveToZoneTip(getPhantomStandbySoftSave(), 'sentinel-behavioral-standby', 'sentinel_soft_standby'),
  ]
}
