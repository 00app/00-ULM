import type { JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
import { soloFocusCardTopicLabel } from '@/lib/zone/soloFocusCardContext'
import { safeGetItem, safeSetItem } from '@/lib/zone/safeProfileStorage'
import type { OfferSignal } from '@/lib/zone/offerSignals'

export type OfferFeedbackSignal = Extract<OfferSignal, 'like' | 'dislike'>

export type OfferFeedbackOption = {
  label: string
  value: string
  ariaLabel?: string
}

export type OfferFeedbackBeat = {
  questionId: string
  signal: OfferFeedbackSignal
  question: string
  options: OfferFeedbackOption[]
}

export const OFFER_FEEDBACK_BEATS: Record<OfferFeedbackSignal, OfferFeedbackBeat> = {
  dislike: {
    signal: 'dislike',
    questionId: 'offer_feedback_dislike',
    question: 'what put you off\nthis one?',
    options: [
      { label: 'COST', value: 'TOO EXPENSIVE', ariaLabel: 'Too expensive' },
      { label: 'NOT ME', value: 'NOT FOR ME', ariaLabel: 'Not for me' },
      { label: 'TRUST', value: 'DONT TRUST IT', ariaLabel: "Don't trust it" },
    ],
  },
  like: {
    signal: 'like',
    questionId: 'offer_feedback_like',
    question: 'what clicked\nfor you?',
    options: [
      { label: 'SAVE', value: 'SAVINGS', ariaLabel: 'The savings' },
      { label: 'EASY', value: 'EASY WIN', ariaLabel: 'Easy win' },
      { label: 'LOCAL', value: 'LOCAL FIT', ariaLabel: 'Fits my area' },
    ],
  },
}

const OFFER_FEEDBACK_LOG_KEY = 'zz_offer_feedback_log_v1'

export type OfferFeedbackLogEntry = {
  cardId: string
  cardTitle: string
  journeyKey: JourneyId
  signal: OfferFeedbackSignal
  questionId: string
  answer: string
  at: string
}

export type OfferFeedbackSettingsRow = {
  id: string
  label: string
  headline: string
  signal: OfferFeedbackSignal
}

function readLog(): OfferFeedbackLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = safeGetItem(OFFER_FEEDBACK_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is OfferFeedbackLogEntry =>
        Boolean(row) &&
        typeof row === 'object' &&
        typeof (row as OfferFeedbackLogEntry).cardId === 'string' &&
        typeof (row as OfferFeedbackLogEntry).answer === 'string'
    )
  } catch {
    return []
  }
}

function writeLog(rows: OfferFeedbackLogEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    safeSetItem(OFFER_FEEDBACK_LOG_KEY, JSON.stringify(rows.slice(-48)))
  } catch {
    /* quota */
  }
}

export function offerFeedbackBeat(signal: OfferFeedbackSignal): OfferFeedbackBeat {
  return OFFER_FEEDBACK_BEATS[signal]
}

export function offerFeedbackQuestionText(
  beat: OfferFeedbackBeat,
  journeyKey: JourneyId,
  cardTitle?: string,
  cardHeadline?: string
): string {
  const topic = soloFocusCardTopicLabel({ cardTitle, headline: cardHeadline, journeyId: journeyKey })
  const category = formatZoneCategoryLabel(journeyKey).toLowerCase()
  return beat.question
    .replace('this one', topic)
    .replace('this card', `this ${category} card`)
}

export function persistOfferFeedbackLocal(entry: Omit<OfferFeedbackLogEntry, 'at'>): void {
  const rows = readLog().filter((r) => r.cardId !== entry.cardId || r.signal !== entry.signal)
  rows.push({ ...entry, at: new Date().toISOString() })
  writeLog(rows)
}

export function readOfferFeedbackForSettings(): OfferFeedbackSettingsRow[] {
  return readLog()
    .slice()
    .reverse()
    .map((row) => ({
      id: `${row.signal}:${row.cardId}`,
      label:
        row.signal === 'like'
          ? `liked · ${formatZoneCategoryLabel(row.journeyKey).toLowerCase()}`
          : `not for me · ${formatZoneCategoryLabel(row.journeyKey).toLowerCase()}`,
      headline: `${row.cardTitle.trim() || row.cardId} — ${row.answer.replace(/_/g, ' ').toLowerCase()}`,
      signal: row.signal,
    }))
}

export async function persistOfferFeedbackRemote(params: {
  cardId: string
  signal: OfferFeedbackSignal
  feedbackAnswer: string
  journeyKey?: string
  cardTitle?: string
}): Promise<void> {
  await fetch('/api/offer-signals', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_id: params.cardId,
      signal: params.signal,
      journey_key: params.journeyKey,
      card_title: params.cardTitle,
      feedback_answer: params.feedbackAnswer,
    }),
  }).catch((error) => {
    console.error('[offerFeedbackLoop] persistOfferFeedbackRemote failed', error, {
      cardId: params.cardId,
      signal: params.signal,
    })
  })
}
