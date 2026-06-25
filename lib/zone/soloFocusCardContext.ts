import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'

export const SOLO_FOCUS_CARD_CONTEXT_KEY = 'zz_solo_focus_card_context_v1'

export type SoloFocusCardContext = {
  cardId: string
  journeyId: JourneyId
  cardTitle: string
  headline: string
  moneyGbp?: number | null
  carbonKg?: number | null
  sourceUrl?: string | null
  offerUrl?: string | null
  sourceLabel?: string | null
  verifiedProviderName?: string | null
  at: string
}

function isValidJourneyId(v: string): v is JourneyId {
  return (JOURNEY_ORDER as readonly string[]).includes(v)
}

export function normalizeSoloFocusJourneyId(raw: string | null | undefined): JourneyId {
  const j = normalizeCategoryToJourneyKey(String(raw ?? 'home'))
  return isValidJourneyId(j) ? j : 'home'
}

export function persistSoloFocusCardContext(ctx: Omit<SoloFocusCardContext, 'at'>): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      SOLO_FOCUS_CARD_CONTEXT_KEY,
      JSON.stringify({ ...ctx, at: new Date().toISOString() })
    )
  } catch {
    /* quota */
  }
}

export function readSoloFocusCardContext(): SoloFocusCardContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SOLO_FOCUS_CARD_CONTEXT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SoloFocusCardContext
    if (!parsed?.cardId || !parsed.journeyId) return null
    return {
      ...parsed,
      journeyId: normalizeSoloFocusJourneyId(parsed.journeyId),
    }
  } catch {
    return null
  }
}

export function clearSoloFocusCardContext(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SOLO_FOCUS_CARD_CONTEXT_KEY)
  } catch {
    /* ignore */
  }
}

/** Short topic fragment for feedback / loop copy — aligned to the active card, not morph drift. */
export function soloFocusCardTopicLabel(ctx: {
  cardTitle?: string | null
  headline?: string | null
  journeyId?: JourneyId | null
}): string {
  const headline = ctx.headline?.trim()
  if (headline) {
    const short = headline.split(/\s+/).slice(0, 8).join(' ')
    if (short.length <= 56) return short.toLowerCase()
  }
  const title = ctx.cardTitle?.trim()
  if (title && title.length <= 56) return title.toLowerCase()
  const jid = ctx.journeyId ?? 'home'
  return `${jid.replace(/_/g, ' ')} tip`
}
