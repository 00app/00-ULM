import pool from '@/lib/db'
import {
  buildDislikeScrapeAvoidHint,
  buildOfferPreferenceState,
  extractOfferTopicKeys,
  journeyKeyFromCardId,
  type OfferPreferenceCard,
} from '@/lib/zone/offerPreference'
import type { JourneyId } from '@/lib/journeys'

type SignalRow = {
  card_id: string
  signal: string
  journey_key: string | null
  card_title: string | null
}

/** Server-side scrape context — recent dislike / indifferent rows from Neon. */
export async function loadOfferAvoidHintForUser(
  userId: string | null | undefined,
  journeyKey?: string | null
): Promise<string> {
  const uid = userId?.trim()
  if (!uid) return ''

  try {
    const res = await pool.query<SignalRow>(
      `SELECT card_id, signal, journey_key, card_title
       FROM offer_signals
       WHERE user_id = $1
         AND signal IN ('dislike', 'indifferent')
         AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC
       LIMIT 48`,
      [uid]
    )
    if (!res.rows?.length) return ''

    const dislikedCardIds: string[] = []
    const indifferentCardIds: string[] = []
    const dislikeSnapshots: OfferPreferenceCard[] = []
    const indifferentSnapshots: OfferPreferenceCard[] = []

    for (const row of res.rows) {
      const card: OfferPreferenceCard = {
        id: row.card_id,
        journey_key: (row.journey_key as JourneyId) ?? journeyKeyFromCardId(row.card_id) ?? undefined,
        title: row.card_title,
      }
      if (row.signal === 'dislike') {
        if (!dislikedCardIds.includes(row.card_id)) dislikedCardIds.push(row.card_id)
        dislikeSnapshots.push(card)
      } else if (row.signal === 'indifferent') {
        if (!indifferentCardIds.includes(row.card_id)) indifferentCardIds.push(row.card_id)
        indifferentSnapshots.push(card)
      }
    }

    const prefs = buildOfferPreferenceState({
      dislikedCardIds,
      indifferentCardIds,
      dislikeSnapshots,
      indifferentSnapshots,
    })

    return buildDislikeScrapeAvoidHint(prefs, journeyKey)
  } catch {
    return ''
  }
}

export function topicKeysFromSignalRows(rows: SignalRow[]): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    if (row.signal !== 'dislike') continue
    for (const k of extractOfferTopicKeys(row.card_title, row.card_id)) keys.add(k)
  }
  return [...keys]
}
