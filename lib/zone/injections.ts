/**
 * Zone tip injection pipeline — validate and merge external cards into the Zone grid.
 * Constraints: 1:1 square ratio (card-compact), monochrome SVGs, use .text-data for £ and kg in UI.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'
import type { ZoneTipCard } from './buildZoneViewModel'
import { isHttpsUrl, trustedUrlForJourney } from './trustedJourneyUrls'

/** Normalize learn/cta/source to a trusted https URL (call for cards that skip validateInjectionCard). */
export function ensureInjectionCardUrls(card: ZoneTipCard): void {
  const fallback = trustedUrlForJourney(card.journey_key)
  const fromActions =
    card.actions?.learnUrl && isHttpsUrl(card.actions.learnUrl) ? card.actions.learnUrl.trim() : ''
  const fromCta = card.cta?.url && isHttpsUrl(card.cta.url) ? card.cta.url.trim() : ''
  const fromSource = card.source && isHttpsUrl(card.source) ? card.source.trim() : ''
  const learn = fromActions || fromCta || fromSource || fallback
  const actionUrl =
    card.actions?.actionUrl && isHttpsUrl(card.actions.actionUrl) ? card.actions.actionUrl.trim() : learn
  card.actions = {
    actionType: card.actions?.actionType ?? 'learn',
    learnUrl: learn,
    actionUrl,
  }
  if (!card.cta?.url || !isHttpsUrl(card.cta.url)) {
    card.cta = {
      label: (card.cta?.label && card.cta.label.trim()) || 'Get this Saving',
      url: learn,
    }
  }
  if (!card.source || !isHttpsUrl(card.source)) {
    card.source = learn
  }
}

export interface InjectionCardInput {
  id: string
  title: string
  journey_key: JourneyId
  category?: JourneyId
  data: { carbon: string; money: string }
  source?: string
  sourceLabel?: string
  explanation?: string[]
  actions?: {
    actionType: 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view'
    learnUrl: string
    actionUrl?: string
  }
  dominant_win?: 'money' | 'carbon'
}

/**
 * Validate a single card from gateway / Gemini payloads (True Card schema).
 * True Card: headline -> title, data.cash -> data.money, cta, followUp, type, location.
 * Ensures h2/headline is cash-focused and .text-data used for values in UI.
 */
export function validateInjectionCard(raw: unknown): ZoneTipCard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : null
  if (!id) return null
  const title = (typeof o.headline === 'string' ? o.headline.trim() : null) ?? (typeof o.title === 'string' ? o.title.trim() : null)
  if (!title) return null
  const jkey = (o.journey_key as JourneyId) ?? 'home'
  const category = (JOURNEY_IDS as readonly string[]).includes(String(o.category ?? o.journey_key ?? 'home'))
    ? ((o.category as JourneyId) ?? jkey)
    : jkey
  if (!JOURNEY_IDS.includes(jkey)) return null
  const data = o.data as Record<string, unknown> | undefined
  const moneyStr = typeof data?.money === 'string' ? data.money : typeof data?.cash === 'string' ? data.cash : null
  const carbonStr = typeof data?.carbon === 'string' ? data.carbon : null
  if (!data || !moneyStr || !carbonStr) return null
  const card: ZoneTipCard = {
    id: id.startsWith('inject-') ? id : `inject-${id}`,
    variant: 'card-compact',
    title,
    journey_key: jkey,
    category,
    data: {
      money: String(moneyStr).trim(),
      carbon: String(carbonStr).trim(),
    },
  }
  if (o.type === 'NationalOffer' || o.type === 'LocalTip') card.type = o.type
  if (typeof o.location === 'string' && o.location.trim()) card.location = o.location.trim()
  if (typeof o.source === 'string') card.source = o.source
  if (typeof o.sourceLabel === 'string') card.sourceLabel = o.sourceLabel
  if (Array.isArray(o.explanation)) card.explanation = o.explanation.filter((e): e is string => typeof e === 'string')
  const cta = o.cta as Record<string, unknown> | undefined
  if (cta && typeof cta.label === 'string' && typeof cta.url === 'string') {
    card.cta = { label: cta.label.trim(), url: cta.url.trim() }
  }
  if (o.actions && typeof o.actions === 'object') {
    const a = o.actions as Record<string, unknown>
    if (typeof a.learnUrl === 'string') {
      const actionType = (a.actionType as 'learn' | 'switch' | 'buy' | 'find' | 'apply' | 'view') ?? 'learn'
      card.actions = {
        actionType,
        learnUrl: a.learnUrl,
        actionUrl: typeof a.actionUrl === 'string' ? a.actionUrl : undefined,
      }
      if (!card.cta) card.cta = { label: 'Get this Saving', url: a.learnUrl }
    }
  }
  const fu = o.followUp as Record<string, unknown> | undefined
  if (fu && typeof fu.question === 'string' && Array.isArray(fu.options) && typeof fu.targetField === 'string') {
    card.followUp = {
      question: fu.question.trim(),
      options: fu.options.filter((x): x is string => typeof x === 'string'),
      targetField: fu.targetField.trim(),
    }
  }
  if (typeof o.badge === 'string' && o.badge.trim()) card.badge = o.badge.trim().slice(0, 48)
  if (o.dominant_win === 'money' || o.dominant_win === 'carbon') {
    card.dominant_win = o.dominant_win
  }
  if (o.high_impact === true) {
    card.high_impact = true
  }
  ensureInjectionCardUrls(card)
  return card
}

/**
 * Validate and filter an array of injection payloads (e.g. from Gemini or internal tools).
 */
export function validateInjectionCards(raw: unknown): ZoneTipCard[] {
  if (!Array.isArray(raw)) return []
  return raw.map(validateInjectionCard).filter((c): c is ZoneTipCard => c != null)
}

/**
 * Merge default tips with injected cards. Injected cards appear after static tips.
 * Use .text-data class in UI for card data values (£ and kg).
 */
export function mergeTipsWithInjections(
  defaultTips: ZoneTipCard[],
  injections: ZoneTipCard[]
): ZoneTipCard[] {
  return [...defaultTips, ...injections]
}
