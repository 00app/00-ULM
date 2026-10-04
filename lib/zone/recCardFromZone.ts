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
import type { JourneyId } from '@/lib/journeys'
import type { RockHabit } from '@/lib/rock/types'
import type { ResearchCategoryCoverageRow } from '@/lib/researchSyncClient'
import { isLibraryActionCardId } from '@/lib/actions/actionLibrary'
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
    whyYou: buildWhyYou(item.journey_key, ctx.facts),
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
    whyYou: buildWhyYou(h.journey_key, ctx.facts),
    openRef: { type: 'habit', id: cardId },
  })
}
