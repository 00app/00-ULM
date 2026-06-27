import type { ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import type { GroovyGridCell } from '@/lib/zone/gridOrder'
import type { RockHabit } from '@/lib/rock/types'
import { clampRockTipHeadline, normalizeCardHeadlineKey, resolveZoneGridTipHeadline } from '@/lib/soloFocusCopy'
import { journeyKeyFromTip } from '@/lib/zone/perCategoryCardCap'

export type HeroLeadWinRow = {
  kind: 'win'
  line: string
  journey: ZoneJourneyCard | null
}

export type HeroLeadTipRow = {
  kind: 'tip'
  line: string
  headline: string
  tip: ZoneTipCard | null
  journeyCell: ZoneJourneyCard | null
  /** When set, opens Rock Solo Focus (`rock-{slug}`). */
  rockSlug?: string
}

export type RockLeadTipRow = {
  kind: 'rock'
  line: string
  headline: string
  tipId: string
  slug: string
}

export type HeroLeadRow = HeroLeadWinRow | HeroLeadTipRow

const ROCK_TIP_LEAD_LABELS = ['Biggest tip', 'Next tip'] as const

/** Rock rail — numbered tip labels below the hero. */
export function formatRockTipLeadLabel(index: number, headline: string): string {
  const label = ROCK_TIP_LEAD_LABELS[index] ?? ROCK_TIP_LEAD_LABELS[1]
  return `${label}: ${headline}`
}

/** Profile hero — single tip-of-the-day line. */
export function formatTipOfDayLabel(headline: string): string {
  return `tip of the day: ${headline}`
}

export function collectTipHeadlineKeys(rows: readonly HeroLeadRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    if (row.kind !== 'tip') continue
    const key = normalizeCardHeadlineKey(row.headline)
    if (key) keys.add(key)
  }
  return keys
}

function parseTipMoneyGbp(tip: ZoneTipCard): number {
  return parseFloat(tip.data?.money?.replace(/[^\d.]/g, '') || '0') || 0
}

/** Profile hero — best category + £/yr on one line. */
export function buildHeroWinLine(category: string, moneyGbp?: number | null): string {
  const cat = category.trim()
  if (!cat) return 'biggest win: check your stats'
  if (moneyGbp != null && moneyGbp > 0) {
    const figure = Math.round(moneyGbp).toLocaleString('en-GB')
    return `biggest win: ${cat} · £${figure}/yr`
  }
  return `biggest win: ${cat}`
}

function journeyCellForTip(
  gridCells: GroovyGridCell[],
  tip: ZoneTipCard
): ZoneJourneyCard | null {
  const jid = journeyKeyFromTip(tip)
  const cell = gridCells.find(
    (c): c is Extract<GroovyGridCell, { type: 'journey' }> =>
      c.type === 'journey' && c.item.journey_key === jid
  )
  return cell?.item ?? null
}

/** Best single tip for profile hero — Rock catalog first, then grid discovery; skips wall duplicates. */
export function pickHeroTipOfDay(args: {
  gridCells: GroovyGridCell[]
  rockHabits?: RockHabit[]
  primaryJourneyWallTitle?: string | null
}): HeroLeadTipRow | null {
  const wallKey = args.primaryJourneyWallTitle
    ? normalizeCardHeadlineKey(args.primaryJourneyWallTitle)
    : ''
  const seenHeadlines = new Set<string>()

  type Candidate = {
    headline: string
    money: number
    tip: ZoneTipCard | null
    journeyCell: ZoneJourneyCard | null
    rockSlug?: string
  }
  const candidates: Candidate[] = []

  for (const h of args.rockHabits ?? []) {
    const headline = clampRockTipHeadline(h.title)
    const headlineKey = normalizeCardHeadlineKey(headline)
    if (!headlineKey || seenHeadlines.has(headlineKey)) continue
    if (wallKey && headlineKey === wallKey) continue
    seenHeadlines.add(headlineKey)
    candidates.push({
      headline,
      money: h.money_gbp ?? 0,
      tip: null,
      journeyCell: null,
      rockSlug: h.slug,
    })
  }

  for (const cell of args.gridCells) {
    if (cell.type !== 'tip') continue
    const tip = cell.tip
    const journeyCell = journeyCellForTip(args.gridCells, tip)
    const headline = resolveZoneGridTipHeadline(tip, journeyCell?.title ?? null)
    const headlineKey = normalizeCardHeadlineKey(headline)
    if (!headlineKey || seenHeadlines.has(headlineKey)) continue
    if (wallKey && headlineKey === wallKey) continue
    seenHeadlines.add(headlineKey)
    candidates.push({
      headline,
      money: parseTipMoneyGbp(tip),
      tip,
      journeyCell,
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.money - a.money)
  const best = candidates[0]
  return {
    kind: 'tip',
    line: formatTipOfDayLabel(best.headline),
    headline: best.headline,
    tip: best.tip,
    journeyCell: best.journeyCell,
    rockSlug: best.rockSlug,
  }
}

/** Today's Tips — same labels + dedupe against hero/grid headlines; opens rock Solo Focus. */
export function pickRockLeadTips(args: {
  habits: RockHabit[]
  excludeHeadlineKeys?: Iterable<string>
  maxTips?: number
}): RockLeadTipRow[] {
  const maxTips = args.maxTips ?? 6
  const excluded = new Set(args.excludeHeadlineKeys ?? [])
  const seenSlug = new Set<string>()
  const seenHeadline = new Set<string>()

  const ranked = [...args.habits]
    .filter((h) => {
      if (seenSlug.has(h.slug)) return false
      const headline = clampRockTipHeadline(h.title)
      const headlineKey = normalizeCardHeadlineKey(headline)
      if (!headlineKey || excluded.has(headlineKey) || seenHeadline.has(headlineKey)) return false
      seenSlug.add(h.slug)
      seenHeadline.add(headlineKey)
      return true
    })
    .sort((a, b) => (b.money_gbp ?? 0) - (a.money_gbp ?? 0))

  return ranked.slice(0, maxTips).map((h, index) => {
    const headline = clampRockTipHeadline(h.title)
    return {
      kind: 'rock' as const,
      line: formatRockTipLeadLabel(index, headline),
      headline,
      tipId: `rock-${h.slug}`,
      slug: h.slug,
    }
  })
}

export function buildHeroLeadRows(args: {
  gridCells: GroovyGridCell[]
  primaryJourney: ZoneJourneyCard | null
  categoryLabel: string
  rockHabits?: RockHabit[]
}): HeroLeadRow[] {
  const wallTitle = args.primaryJourney?.title ?? null
  const rows: HeroLeadRow[] = []

  const tip = pickHeroTipOfDay({
    gridCells: args.gridCells,
    rockHabits: args.rockHabits,
    primaryJourneyWallTitle: wallTitle,
  })
  if (tip) rows.push(tip)

  rows.push({
    kind: 'win',
    line: args.primaryJourney
      ? buildHeroWinLine(args.categoryLabel, args.primaryJourney.moneyGbp)
      : 'biggest win: check your stats',
    journey: args.primaryJourney,
  })

  return rows
}
