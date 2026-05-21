import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import type { BentoPersona } from '@/lib/zone/bentoPersona'
import type { ZoneJourneyCard, ZoneTipCard, ZoneViewModel } from '@/lib/logic/zone'
import { normalizePrimaryGoal } from '@/lib/zone/affluenceCheck'
import { dedupeZoneTipCards } from '@/lib/zone/injections'
import {
  capDiscoveryTipsForGrid,
  SHOW_BASELINE_TIPS_ON_MAIN_GRID,
} from '@/lib/zone/perCategoryCardCap'
import { MAX_ZONE_BENTO_CELLS } from '@/lib/zone/ulmLimits'

export type GroovyGridCell =
  | { type: 'hero'; hero: ZoneViewModel['hero'] }
  | { type: 'tip'; tip: ZoneTipCard }
  | { type: 'journey'; item: ZoneJourneyCard; index: number; persona: BentoPersona }

function sortTipsWithinJourney(tips: ZoneTipCard[], goal?: string): ZoneTipCard[] {
  const sortGoal = normalizePrimaryGoal(goal)
  const list = [...tips]
  list.sort((a, b) => {
    if (a.achievement_discovery && !b.achievement_discovery) return -1
    if (!a.achievement_discovery && b.achievement_discovery) return 1
    if (sortGoal === 'money' || sortGoal === 'carbon') {
      const parseMoney = (t: ZoneTipCard) =>
        parseFloat(t.data?.money?.replace(/[^\d.]/g, '') || '0') || 0
      const parseCarbon = (t: ZoneTipCard) =>
        parseFloat(t.data?.carbon?.replace(/[^\d.]/g, '') || '0') || 0
      if (sortGoal === 'money') return parseMoney(b) - parseMoney(a)
      return parseCarbon(b) - parseCarbon(a)
    }
    return 0
  })
  return list
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
}): GroovyGridCell[] {
  const journeyCardsOnly = args.viewModel.journeys.filter((j) => j.id.startsWith('journey-'))
  const byJourney = new Map(journeyCardsOnly.map((j) => [j.journey_key, j]))
  const seenTipIds = new Set<string>()

  const discoveryByJourney = new Map<JourneyId, ZoneTipCard[]>()
  for (const tip of capDiscoveryTipsForGrid(dedupeZoneTipCards(args.discoveryTips ?? []))) {
    const jid = (tip.journey_key ?? 'home') as JourneyId
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

  for (const tip of dedupeZoneTipCards(args.achievementTips ?? [])) {
    if (seenTipIds.has(tip.id)) continue
    seenTipIds.add(tip.id)
    items.push({ type: 'tip', tip })
  }

  JOURNEY_ORDER.forEach((jid, index) => {
    const item = byJourney.get(jid)
    if (item) {
      items.push({
        type: 'journey',
        item,
        index,
        persona: args.personaForJourney(jid),
      })
    }
    const nestedDiscovery = sortTipsWithinJourney(discoveryByJourney.get(jid) ?? [], args.profileGoal)
    for (const tip of nestedDiscovery) {
      items.push({ type: 'tip', tip })
    }
    const nestedBaseline = sortTipsWithinJourney(baselineByJourney.get(jid) ?? [], args.profileGoal)
    for (const tip of nestedBaseline) {
      items.push({ type: 'tip', tip })
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
