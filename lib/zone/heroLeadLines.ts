import type { ZoneJourneyCard, ZoneTipCard } from '@/lib/logic/zone'
import type { GroovyGridCell } from '@/lib/zone/gridOrder'
import type { RockHabit } from '@/lib/rock/types'
import { getUkSeason } from '@/lib/zone/seasonHint'
import { clampRockTipHeadline, normalizeCardHeadlineKey, resolveZoneGridTipHeadline } from '@/lib/soloFocusCopy'
import { journeyKeyFromTip } from '@/lib/zone/perCategoryCardCap'

export type RockLeadTipRow = {
  kind: 'rock'
  line: string
  headline: string
  tipId: string
  slug: string
}

const ROCK_TIP_LEAD_LABELS = ['Biggest tip', 'Next tip'] as const

/** Rock rail — numbered tip labels below the hero. */
export function formatRockTipLeadLabel(index: number, headline: string): string {
  const label = ROCK_TIP_LEAD_LABELS[index] ?? ROCK_TIP_LEAD_LABELS[1]
  return `${label}: ${headline}`
}

function parseTipMoneyGbp(tip: ZoneTipCard): number {
  return parseFloat(tip.data?.money?.replace(/[^\d.]/g, '') || '0') || 0
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

type HeroWinCandidate = {
  headline: string
  money: number
  tip: ZoneTipCard | null
  journeyCell: ZoneJourneyCard | null
  rockSlug?: string
  /** Rock habits are the small, "trickle" catalog by design — the effort-proxy for "Quick win". */
  isRockHabit: boolean
  seasons?: RockHabit['seasons']
}

/** Same candidate pool the hero used to pick its single tip-of-the-day from — Rock catalog +
 *  grid discovery tips, deduped by headline, skipping whatever's already the wall's own title. */
function gatherHeroWinCandidates(args: {
  gridCells: GroovyGridCell[]
  rockHabits?: RockHabit[]
  primaryJourneyWallTitle?: string | null
}): HeroWinCandidate[] {
  const wallKey = args.primaryJourneyWallTitle
    ? normalizeCardHeadlineKey(args.primaryJourneyWallTitle)
    : ''
  const seenHeadlines = new Set<string>()
  const candidates: HeroWinCandidate[] = []

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
      isRockHabit: true,
      seasons: h.seasons,
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
      isRockHabit: false,
    })
  }

  return candidates
}

export type HeroWinSlotLabel = 'Quick win' | 'Big win' | 'Do now'

export type HeroWinSlot = {
  kind: 'win-slot'
  label: HeroWinSlotLabel
  /** null when there wasn't a distinct candidate left for this slot ("it needed more info"). */
  line: string | null
  headline: string | null
  tip: ZoneTipCard | null
  journeyCell: ZoneJourneyCard | null
  rockSlug?: string
}

const HERO_NEEDS_INFO_LINE = 'It needed more info.'

function formatWinSlotLine(label: HeroWinSlotLabel, headline: string): string {
  return `${label}: ${headline}`
}

/** Profile hero — top 3 wins. Quick win favours the small Rock catalog habits (the
 *  low-effort "trickle" content by design); Big win is the single highest £ candidate;
 *  Do now prefers whatever's in-season right now, falling back to the next best candidate.
 *  A slot with no distinct candidate left renders the "needed more info" state instead of
 *  reusing another slot's pick. */
export function buildTopThreeWinRows(args: {
  gridCells: GroovyGridCell[]
  primaryJourney: ZoneJourneyCard | null
  rockHabits?: RockHabit[]
}): HeroWinSlot[] {
  const wallTitle = args.primaryJourney?.title ?? null
  const pool = gatherHeroWinCandidates({
    gridCells: args.gridCells,
    rockHabits: args.rockHabits,
    primaryJourneyWallTitle: wallTitle,
  }).sort((a, b) => b.money - a.money)

  const used = new Set<string>()
  const take = (predicate?: (c: HeroWinCandidate) => boolean): HeroWinCandidate | null => {
    const found = pool.find((c) => !used.has(c.headline) && (!predicate || predicate(c)))
    if (found) used.add(found.headline)
    return found ?? null
  }

  const quick = take((c) => c.isRockHabit)
  const big = take()
  const season = getUkSeason()
  const doNow =
    take((c) => c.isRockHabit && !!c.seasons?.includes(season)) ?? take()

  const toSlot = (label: HeroWinSlotLabel, c: HeroWinCandidate | null): HeroWinSlot =>
    c
      ? {
          kind: 'win-slot',
          label,
          line: formatWinSlotLine(label, c.headline),
          headline: c.headline,
          tip: c.tip,
          journeyCell: c.journeyCell,
          rockSlug: c.rockSlug,
        }
      : {
          kind: 'win-slot',
          label,
          line: null,
          headline: null,
          tip: null,
          journeyCell: null,
        }

  return [toSlot('Quick win', quick), toSlot('Big win', big), toSlot('Do now', doNow)]
}

export { HERO_NEEDS_INFO_LINE }

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

