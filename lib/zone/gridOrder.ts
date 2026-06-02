import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { BentoPersona } from '@/lib/zone/bentoPersona'
import type { ZoneJourneyCard, ZoneTipCard, ZoneViewModel } from '@/lib/logic/zone'
import { goalSortWeights } from '@/lib/profile/goalWeighting'
import { normalizePrimaryGoal } from '@/lib/zone/affluenceCheck'
import { dedupeZoneTipCards } from '@/lib/zone/injections'
import {
  capCategoryWallTips,
  journeyKeyFromTip,
  SHOW_BASELINE_TIPS_ON_MAIN_GRID,
  MAX_CARDS_PER_CATEGORY,
} from '@/lib/zone/perCategoryCardCap'
import { MAX_ZONE_BENTO_CELLS } from '@/lib/zone/ulmLimits'
import { isUtilitiesZoneCardUnlocked } from '@/lib/zone/utilitiesZoneUnlock'
import { normalizeCardHeadlineKey, resolveZoneGridTipHeadline } from '@/lib/soloFocusCopy'
import { uniquifyZoneTipOfferUrl } from '@/lib/zone/zoneOfferUrl'

export type GroovyGridCell =
  | { type: 'hero'; hero: ZoneViewModel['hero'] }
  | { type: 'tip'; tip: ZoneTipCard }
  | { type: 'journey'; item: ZoneJourneyCard; index: number; persona: BentoPersona }

function sortTipsWithinJourney(tips: ZoneTipCard[], goal?: string): ZoneTipCard[] {
  const sortGoal = normalizePrimaryGoal(goal)
  const weights = goalSortWeights(goal)
  const list = [...tips]
  list.sort((a, b) => {
    if (a.achievement_discovery && !b.achievement_discovery) return -1
    if (!a.achievement_discovery && b.achievement_discovery) return 1
    const parseMoney = (t: ZoneTipCard) =>
      parseFloat(t.data?.money?.replace(/[^\d.]/g, '') || '0') || 0
    const parseCarbon = (t: ZoneTipCard) =>
      parseFloat(t.data?.carbon?.replace(/[^\d.]/g, '') || '0') || 0
    if (sortGoal === 'money') return parseMoney(b) - parseMoney(a)
    if (sortGoal === 'carbon') return parseCarbon(b) - parseCarbon(a)
    return (
      parseCarbon(b) * weights.carbon +
      parseMoney(b) * weights.money -
      (parseCarbon(a) * weights.carbon + parseMoney(a) * weights.money)
    )
  })
  return list
}

/** Resolve inject headline and skip tips that still duplicate the journey mother tile. */
function tipForWallGrid(tip: ZoneTipCard, journeyWallTitle: string | null): ZoneTipCard | null {
  const resolved = resolveZoneGridTipHeadline(tip, journeyWallTitle)
  const resolvedKey = normalizeCardHeadlineKey(resolved)
  const wallKey = journeyWallTitle ? normalizeCardHeadlineKey(journeyWallTitle) : ''
  if (wallKey && resolvedKey && resolvedKey === wallKey) return null
  if (resolved === (tip.title ?? '').trim()) return tip
  return { ...tip, title: resolved }
}

/** Hero → pinned achievements → each journey in JOURNEY_ORDER with discovery tips nested after parent. */
export function buildGroovyGridItems(args: {
  viewModel: ZoneViewModel
  achievementTips?: ZoneTipCard[]
  discoveryTips?: ZoneTipCard[]
  /** Ranked `tip-*` cards from the view model (3 category tips when no injection replaces them). */
  baselineTips?: ZoneTipCard[]
  personaForJourney: (jid: JourneyId) => BentoPersona
  profileGoal?: string
  /** Profile power type — when set, UTILITIES becomes the 13th journey cell on the wall. */
  profile?: { home_power?: string; homePower?: string }
}): GroovyGridCell[] {
  const journeyCardsOnly = args.viewModel.journeys.filter((j) => j.id.startsWith('journey-'))
  const byJourney = new Map(journeyCardsOnly.map((j) => [j.journey_key, j]))
  const seenTipIds = new Set<string>()

  const discoveryByJourney = new Map<JourneyId, ZoneTipCard[]>()
  const wallTips = capCategoryWallTips(
    dedupeZoneTipCards([...(args.discoveryTips ?? []), ...(args.achievementTips ?? [])])
  )
  for (const tip of wallTips) {
    const jid = journeyKeyFromTip(tip)
    if (seenTipIds.has(tip.id)) continue
    seenTipIds.add(tip.id)
    const bucket = discoveryByJourney.get(jid) ?? []
    bucket.push(tip)
    discoveryByJourney.set(jid, bucket)
  }

  const baselineByJourney = new Map<JourneyId, ZoneTipCard[]>()
  if (SHOW_BASELINE_TIPS_ON_MAIN_GRID) {
    for (const tip of dedupeZoneTipCards(args.baselineTips ?? [])) {
      const jid = (tip.journey_key ?? 'home') as JourneyId
      if (seenTipIds.has(tip.id)) continue
      seenTipIds.add(tip.id)
      const bucket = baselineByJourney.get(jid) ?? []
      bucket.push(tip)
      baselineByJourney.set(jid, bucket)
    }
  }

  const items: GroovyGridCell[] = [{ type: 'hero', hero: args.viewModel.hero }]

  /** One distinct BUY URL per journey on the wall (no duplicate National Rail tiles). */
  const seenOfferUrlsByJourney = new Map<JourneyId, Set<string>>()

  /** Track how many cells (journey + tips) have been placed per category. */
  const categoryCardCount = new Map<JourneyId, number>()

  const incrementCategory = (jid: JourneyId): boolean => {
    const current = categoryCardCount.get(jid) ?? 0
    if (current >= MAX_CARDS_PER_CATEGORY) return false
    categoryCardCount.set(jid, current + 1)
    return true
  }

  JOURNEY_ORDER.forEach((jid, index) => {
    const item = byJourney.get(jid)
    if (item) {
      // Journey card always placed first for its category (counts as 1 toward the cap)
      if (incrementCategory(jid)) {
        items.push({
          type: 'journey',
          item,
          index,
          persona: args.personaForJourney(jid),
        })
      }
    }
    const journeyWallTitle = item?.title ?? null
    const seenHeadlineKeys = new Set<string>()
    if (journeyWallTitle) {
      const wallKey = normalizeCardHeadlineKey(journeyWallTitle)
      if (wallKey) seenHeadlineKeys.add(wallKey)
    }
    const nestedDiscovery = sortTipsWithinJourney(discoveryByJourney.get(jid) ?? [], args.profileGoal)
    for (const tip of nestedDiscovery) {
      const gridTip = tipForWallGrid(tip, journeyWallTitle)
      if (!gridTip) continue
      const headlineKey = normalizeCardHeadlineKey(gridTip.title ?? '')
      if (headlineKey && seenHeadlineKeys.has(headlineKey)) continue
      if (headlineKey) seenHeadlineKeys.add(headlineKey)
      if (!incrementCategory(jid)) break
      items.push({
        type: 'tip',
        tip: uniquifyZoneTipOfferUrl(gridTip, seenOfferUrlsByJourney),
      })
    }
    const nestedBaseline = sortTipsWithinJourney(baselineByJourney.get(jid) ?? [], args.profileGoal)
    for (const tip of nestedBaseline) {
      const gridTip = tipForWallGrid(tip, journeyWallTitle)
      if (!gridTip) continue
      const headlineKey = normalizeCardHeadlineKey(gridTip.title ?? '')
      if (headlineKey && seenHeadlineKeys.has(headlineKey)) continue
      if (headlineKey) seenHeadlineKeys.add(headlineKey)
      if (!incrementCategory(jid)) break
      items.push({
        type: 'tip',
        tip: uniquifyZoneTipOfferUrl(gridTip, seenOfferUrlsByJourney),
      })
    }
  })

  return clipGroovyGridToCeiling(items)
}

/** ULM — hard ceiling on journey + tip cells (hero excluded). */
export function clipGroovyGridToCeiling(items: GroovyGridCell[]): GroovyGridCell[] {
  const hero = items.filter((i) => i.type === 'hero')
  const rest = items.filter((i) => i.type !== 'hero')
  if (rest.length <= MAX_ZONE_BENTO_CELLS) return items

  const clipped: GroovyGridCell[] = []
  for (const cell of rest) {
    if (clipped.length >= MAX_ZONE_BENTO_CELLS) break
    clipped.push(cell)
  }
  return [...hero, ...clipped]
}
