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
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'
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
  return resolveRecCard({
    id: item.id,
    size: 'large',
    category: item.journey_key,
    label: formatZoneCategoryLabel(item.journey_key),
    actionWording: item.title,
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
    actionWording: tip.title,
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
    actionWording: h.title,
    whyYou: buildWhyYou(h.journey_key, ctx.facts),
    openRef: { type: 'habit', id: cardId },
  })
}
