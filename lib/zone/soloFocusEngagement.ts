import { recordOfferSignal, type OfferSignal } from '@/lib/zone/offerSignals'
import { saveIndifferentCardSnapshot } from '@/lib/client/indifferentCardSnapshots'
import type { JourneyId } from '@/lib/journeys'

export type SoloFocusEngagementKind = 'none' | OfferSignal | 'cta'

export type SoloFocusEngagementRef = { current: SoloFocusEngagementKind }

export function createSoloFocusEngagementRef(): SoloFocusEngagementRef {
  return { current: 'none' }
}

export function markSoloFocusEngagement(
  ref: SoloFocusEngagementRef,
  kind: Exclude<SoloFocusEngagementKind, 'none'>
): void {
  ref.current = kind
}

export function flushSoloFocusIndifferent(
  ref: SoloFocusEngagementRef,
  params: {
    card_id: string
    journey_key?: string | null
    card_title?: string | null
    money_gbp?: number | null
  }
): void {
  if (ref.current !== 'none') return
  const jid = params.journey_key?.replace(/^journey-/, '') as JourneyId | undefined
  if (jid) {
    saveIndifferentCardSnapshot({
      id: params.card_id,
      journey_key: jid,
      title: params.card_title ?? params.card_id,
    })
  }
  recordOfferSignal({
    card_id: params.card_id,
    signal: 'indifferent',
    journey_key: params.journey_key,
    card_title: params.card_title,
    money_gbp: params.money_gbp,
  })
}
