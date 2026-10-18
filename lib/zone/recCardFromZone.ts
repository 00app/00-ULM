/**
 * Maps the Zone's existing card data onto the one recommendation-card anatomy.
 *
 * Verified £ rule (mechanical truth): `source_name` / `source_date` on view-model cards are
 * stamped on EVERY card ("April 2026"), so they prove a citation exists, not that the figure is
 * verified. The only real verification signal is the Neon research row for the category
 * (`latestSavingGbp` / `latestVerifiedGbp` WITH a `latestSourceUrl`). Only that produces a £.
 * Tips and Today habits carry indicative figures and so never show one.
 */

import type { ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import type { HeroWinSlot } from '@/lib/zone/heroLeadLines'
import type { JourneyId } from '@/lib/journeys'
import type { RockHabit } from '@/lib/rock/types'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { isLibraryActionCardId, libraryActionForAnyCardId } from '@/lib/actions/actionLibrary'
import { parseCarbonKgFromDisplay, parseMoneyGbpFromDisplay } from '@/lib/format'
import { journeyTimeframe } from '@/lib/zone/zoneFilter'
import {
  clampRockTipHeadline,
  clampZoneBentoHeadline,
  formatZoneCategoryLabel,
  MAX_ZONE_CARD_HEADLINE_WORDS,
  resolveZoneGridTipHeadline,
  zoneCardHeadlineFromRaw,
} from '@/lib/soloFocusCopy'
import {
  buildWhyYou,
  resolveRecCard,
  type RecCardModel,
  type SavingSource,
  type TypicalSaving,
  type WhyYouFacts,
} from '@/lib/zone/recCard'

export type RecCardContext = {
  facts: WhyYouFacts
  coverage?: Record<string, ResearchCategoryCoverageRow> | null
  /** Journey title for a category, used to resolve wall-tip headlines the way the grid did. */
  journeyTitle?: (journeyKey: JourneyId) => string | null
}

function hostLabel(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return h || null
  } catch {
    return null
  }
}

/** Verified £/yr + its source for a journey, or nulls. */
export function verifiedSavingForJourney(
  journeyKey: JourneyId,
  cardId: string,
  coverage: RecCardContext['coverage']
): { gbp: number | null; source: SavingSource | null } {
  if (isLibraryActionCardId(cardId)) return { gbp: null, source: null }
  const row = coverage?.[journeyKey]
  if (!row) return { gbp: null, source: null }
  const gbp =
    (row.latestSavingGbp ?? 0) > 0
      ? (row.latestSavingGbp as number)
      : (row.latestVerifiedGbp ?? 0) > 0
        ? (row.latestVerifiedGbp as number)
        : null
  const url = row.latestSourceUrl?.trim() || null
  const name = hostLabel(url)
  if (gbp == null || !url || !name) return { gbp: null, source: null }
  return { gbp, source: { kind: 'verified', name, url } }
}

function tipImpact(tip: ZoneTipCard): { money: boolean; carbon: boolean } {
  const money = parseMoneyGbpFromDisplay(String(tip.data?.money ?? '0')) > 0
  const carbon = parseCarbonKgFromDisplay(String(tip.data?.carbon ?? '0')) > 0
  return {
    money: money || tip.dominant_win === 'money',
    carbon: carbon || tip.dominant_win === 'carbon',
  }
}

/**
 * A library action's reference value, cited to its source and dated by when it was checked.
 *
 * Traceability rule: the figure is shown only when that exact amount appears in the action's own
 * cited text (detail or source), so every £ on a card can be read back from where it came from.
 * Library values that are estimates (e.g. Council Tax Reduction's £1,200, which GOV.UK never
 * states) stay off the card. The wording follows the text: "up to" stays "up to", "average"
 * stays "on average"; "a year" only for annual actions whose text is not a one-off "up to".
 */
export function typicalSavingForLibraryCard(cardId: string): TypicalSaving | null {
  const a = libraryActionForAnyCardId(cardId)
  if (!a || !(a.valueGbp > 0)) return null
  const name = hostLabel(a.url)
  if (!name) return null
  const text = `${a.detail} ${a.source}`
  const n = Math.round(a.valueGbp)
  const figurePattern = new RegExp(`£\\s?(${n.toLocaleString('en-GB').replace(/,/g, ',?')})(?![\\d.,]*\\d)`)
  const m = figurePattern.exec(text)
  if (!m) return null
  const around = text.slice(Math.max(0, m.index - 24), m.index + m[0].length + 24).toLowerCase()
  const phrase: TypicalSaving['phrase'] = /up to/.test(around) ? 'up_to' : /average/.test(around) ? 'average' : 'typical'
  const perYear = a.recurrence === 'ANNUAL' && phrase !== 'up_to' ? true : /a year|\/yr|per year|annual/.test(around)
  return { gbp: n, phrase, perYear, source: { kind: 'typical', name, url: a.url, date: a.verifiedOn } }
}

/**
 * The action's key fact for the tile: the first sentence of its detail that does more than
 * restate the figure (WHD's "£150 off your electricity bill." is skipped for the sentence after).
 */
export function insightForLibraryCard(cardId: string, detail?: string | null): string | null {
  const a = libraryActionForAnyCardId(cardId)
  if (!a) return null
  const text = (detail?.trim() || a.detail).replace(/\s+/g, ' ')
  // Split only at a full stop followed by a new sentence, never inside "£241.80" or "£12.50".
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z£(])/).map((s) => s.trim()).filter(Boolean)
  const pick = sentences.find((s) => !/^£[\d,.]+\s/.test(s) && s.length >= 25) ?? sentences[0]
  if (!pick) return null
  return pick.length > 160 ? `${pick.slice(0, 157).replace(/\s+\S*$/, '')}…` : pick
}

const LIBRARY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Solo Focus source line for a library action: its full citation and the month it was checked. */
export function librarySourceLine(a: { source: string; verifiedOn: string }): string {
  const m = /^(\d{4})-(\d{2})/.exec(a.verifiedOn)
  const when = m ? `${LIBRARY_MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim() : a.verifiedOn
  return `Source: ${a.source}. Checked ${when}.`
}

/**
 * Same traceability rule for carbon: a library action's kg figure is shown only when its cited
 * text states it. The library's valueKg values are estimates, so in practice this hides them.
 */
export function libraryCarbonTraceable(a: { valueKg: number; detail: string; source: string }): boolean {
  if (!(a.valueKg > 0)) return false
  const n = Math.round(a.valueKg).toLocaleString('en-GB').replace(/,/g, ',?')
  return new RegExp(`\\b${n}\\s?(kg|kilograms?)\\b`, 'i').test(`${a.detail} ${a.source}`)
}

/** Label over the £ in Solo Focus for a traceable library figure, worded like the source. */
export function libraryMoneyLabel(t: TypicalSaving | null): string | undefined {
  if (!t) return undefined
  if (t.phrase === 'up_to') return t.perYear ? 'Up to, each year' : 'Worth up to'
  if (t.phrase === 'average') return 'Average a year'
  return t.perYear ? 'Typical saving a year' : 'Typical saving'
}

export function journeyToRecCard(item: ZoneJourneyCard, ctx: RecCardContext): RecCardModel | null {
  const { gbp, source } = verifiedSavingForJourney(item.journey_key, item.id, ctx.coverage)
  const label = formatZoneCategoryLabel(item.journey_key)
  // Same wording rules the wall tile used: library cards keep their own short title; others go
  // through the zone headline clamp (never a stale per-category hook swapped in for a good title).
  const actionWording = isLibraryActionCardId(item.id)
    ? clampRockTipHeadline(item.title || String(item.journey_key))
    : clampZoneBentoHeadline(
        zoneCardHeadlineFromRaw(item.title || String(item.journey_key), label, MAX_ZONE_CARD_HEADLINE_WORDS),
        String(item.journey_key)
      )
  return resolveRecCard({
    id: item.id,
    size: 'large',
    category: item.journey_key,
    label,
    actionWording,
    savingGbpPerYear: gbp,
    savingSource: source,
    typicalSaving: typicalSavingForLibraryCard(item.id),
    insight: insightForLibraryCard(item.id, item.explanation?.[0] ?? null),
    fromLibrary: libraryActionForAnyCardId(item.id) != null,
    whyYou: buildWhyYou(item.journey_key, ctx.facts),
    impact: {
      money: (item.moneyGbp ?? parseMoneyGbpFromDisplay(String(item.data?.money ?? '0'))) > 0,
      carbon: (item.carbonKg ?? parseCarbonKgFromDisplay(String(item.data?.carbon ?? '0'))) > 0,
    },
    pace: journeyTimeframe(item),
    openRef: { type: 'journey', id: item.id },
  })
}

export function tipToRecCard(tip: ZoneTipCard, ctx: RecCardContext): RecCardModel | null {
  const category = (tip.journey_key ?? tip.category) as JourneyId
  return resolveRecCard({
    id: tip.id,
    size: 'large',
    category,
    label: formatZoneCategoryLabel(category),
    actionWording: resolveZoneGridTipHeadline(tip, ctx.journeyTitle?.(category) ?? null),
    whyYou: buildWhyYou(category, ctx.facts),
    impact: tipImpact(tip),
    pace: 'now',
    openRef: { type: 'tip', id: tip.id },
  })
}

/** Today rail: small cards from the season-ranked Rock habits (order is preserved by the caller). */
export function habitToRecCard(h: RockHabit, cardId: string, ctx: RecCardContext): RecCardModel | null {
  return resolveRecCard({
    id: cardId,
    size: 'small',
    category: h.journey_key,
    label: formatZoneCategoryLabel(h.journey_key),
    actionWording: clampRockTipHeadline(h.title),
    typicalSaving: typicalSavingForLibraryCard(cardId),
    insight: insightForLibraryCard(cardId),
    fromLibrary: libraryActionForAnyCardId(cardId) != null,
    whyYou: buildWhyYou(h.journey_key, ctx.facts),
    impact: { money: h.money_gbp > 0 || h.impact_tag === 'money' || h.impact_tag === 'both', carbon: h.carbon_kg > 0 || h.impact_tag === 'carbon' || h.impact_tag === 'both' },
    pace: 'now',
    openRef: { type: 'habit', id: cardId },
  })
}

/**
 * Profile hero slot (Quick win / Big win / Do now) as a card. The slot label is the card label, so
 * it reads "QUICK WIN" above the action. Empty slots ("needed more info") produce no card, and a
 * slot whose category can't say why it's for you produces none either.
 */
export function heroSlotToRecCard(
  slot: HeroWinSlot,
  ctx: RecCardContext,
  habitJourneyBySlug: (slug: string) => JourneyId | null,
  habitLookup?: (slug: string) => RockHabit | null
): RecCardModel | null {
  if (!slot.headline) return null
  const category: JourneyId | null = slot.rockSlug
    ? habitJourneyBySlug(slot.rockSlug)
    : ((slot.tip?.journey_key ?? slot.journeyCell?.journey_key ?? null) as JourneyId | null)
  if (!category) return null
  const openRef = slot.rockSlug
    ? ({ type: 'habit', id: `rock-${slot.rockSlug}` } as const)
    : slot.tip
      ? ({ type: 'tip', id: slot.tip.id } as const)
      : null
  if (!openRef) return null
  return resolveRecCard({
    id: openRef.id,
    size: 'large',
    category,
    label: slot.label.toUpperCase(),
    actionWording: slot.headline,
    typicalSaving: typicalSavingForLibraryCard(openRef.id),
    insight: insightForLibraryCard(openRef.id),
    fromLibrary: libraryActionForAnyCardId(openRef.id) != null,
    whyYou: buildWhyYou(category, ctx.facts),
    impact: slot.tip
      ? tipImpact(slot.tip)
      : (() => {
          const h = slot.rockSlug ? habitLookup?.(slot.rockSlug) : null
          return { money: !!h && (h.money_gbp > 0 || h.impact_tag === 'money' || h.impact_tag === 'both'), carbon: !!h && (h.carbon_kg > 0 || h.impact_tag === 'carbon' || h.impact_tag === 'both') }
        })(),
    pace: 'now',
    openRef,
  })
}
