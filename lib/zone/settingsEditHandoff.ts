import type { JourneyId } from '@/lib/journeys'
import { zoneCardDomId, zoneJourneyDomId } from '@/lib/zone/soloFocusReturn'

export const ANSWER_COMMITTED_EVENT = 'zz_answer_committed'

const HANDOFF_KEY = 'zz_settings_edit_zone_handoff'

export type SettingsEditZoneHandoff = {
  journeyKey: JourneyId
  cardId: string
  surface: 'journey' | 'discovery'
}

export function readJourneyAnswerRaw(journeyId: JourneyId, questionId: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(`journey_${journeyId}_answers`)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    return String(map[questionId] ?? '').trim()
  } catch {
    return ''
  }
}

export function answersEqual(a: string, b: string): boolean {
  return a.trim() === b.trim()
}

export function dispatchAnswerCommitted(detail: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(ANSWER_COMMITTED_EVENT, {
      detail: {
        journeyId: detail.journeyId,
        questionId: detail.questionId,
        answerValue: detail.answerValue,
        committedAt: Date.now(),
      },
    })
  )
}

export function writeSettingsEditZoneHandoff(handoff: SettingsEditZoneHandoff): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    /* quota */
  }
}

export function consumeSettingsEditZoneHandoff(): SettingsEditZoneHandoff | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    sessionStorage.removeItem(HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SettingsEditZoneHandoff
    if (!parsed?.journeyKey || !parsed?.cardId) return null
    return parsed
  } catch {
    return null
  }
}

const SCROLL_DELAY_MS = 450

/** Scroll Zone wall to journey mother or discovery inject after Settings edit handoff. */
export function scrollSettingsEditZoneHandoff(handoff: SettingsEditZoneHandoff | null | undefined): void {
  if (!handoff || typeof document === 'undefined') return

  const run = () => {
    if (handoff.surface === 'discovery') {
      document.getElementById(zoneCardDomId(handoff.cardId))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    document.getElementById(zoneJourneyDomId(handoff.journeyKey))?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(run, SCROLL_DELAY_MS)
  })
}
