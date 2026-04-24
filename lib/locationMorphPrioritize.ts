/**
 * Morph deck — boost region-matched grants (e.g. Scottish energy programmes) when the profile postcode is Scotland.
 */

import { isScottishPostcodeArea } from '@/lib/zone/regionalGrants'
import type { LocalIntelligence } from '@/lib/local/getLocalData'

type ProfileContext = { transport?: string | null } | null | undefined

function scottishRelevanceScore(card: unknown): number {
  const blob = typeof card === 'object' && card != null ? JSON.stringify(card).toLowerCase() : ''
  let s = 0
  if (
    /scot|glasgow|edinburgh|aberdeen|orkney|shetland|highland|hes\b|home energy scotland|warm homes scotland|rural uplift|kw1|wick|bus grant scotland|fabric first scotland/i.test(
      blob
    )
  ) {
    s += 5
  }
  if (/boiler upgrade scheme|£7,?500/.test(blob) && !/scot|hes|warm homes scot/i.test(blob)) s -= 1
  return s
}

/** When `local` says Scotland (or postcode outward matches), sort morph cards with Scottish signal first (stable within equal scores). */
export function prioritizeMorphCardsForRegion(
  cards: unknown[] | null | undefined,
  opts: { postcode?: string | null; local?: LocalIntelligence | null }
): unknown[] {
  if (!cards?.length) return (cards ?? []) as unknown[]
  const region = (opts.local?.region ?? '').toLowerCase()
  const scotFromLocal = region.includes('scotland')
  const scot = scotFromLocal || isScottishPostcodeArea(opts.postcode)
  if (!scot) return [...cards]

  const scored = cards.map((c, i) => ({ c, i, s: scottishRelevanceScore(c) }))
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  return scored.map((x) => x.c)
}

function profileRelevanceScore(card: unknown, profile?: ProfileContext, journeyAnswers?: Record<string, Record<string, string>>): number {
  const blob = typeof card === 'object' && card != null ? JSON.stringify(card).toLowerCase() : ''
  if (!blob) return 0
  let s = 0
  const transport = (profile?.transport ?? '').toUpperCase()
  const fuel = (journeyAnswers?.travel?.fuel_type ?? '').toUpperCase()
  const petrolFirst =
    fuel === 'PETROL' ||
    transport === 'CAR' ||
    /petrol|diesel|fuel|mpg|tyre|idling|maintenance|pump/i.test(blob)

  if (petrolFirst) {
    if (/petrol|diesel|fuel|mpg|tyre|idling|maintenance|pump|car efficiency|eco driving/i.test(blob)) s += 6
    if (/ev salary|chargepoint|battery|electric only|heat pump when driving/i.test(blob)) s -= 2
  }
  return s
}

export function prioritizeMorphCardsForContext(
  cards: unknown[] | null | undefined,
  opts: {
    postcode?: string | null
    local?: LocalIntelligence | null
    profile?: ProfileContext
    journeyAnswers?: Record<string, Record<string, string>>
  }
): unknown[] {
  const regionFirst = prioritizeMorphCardsForRegion(cards, { postcode: opts.postcode, local: opts.local })
  const scored = regionFirst.map((c, i) => ({
    c,
    i,
    s: profileRelevanceScore(c, opts.profile, opts.journeyAnswers),
  }))
  scored.sort((a, b) => b.s - a.s || a.i - b.i)
  return scored.map((x) => x.c)
}
