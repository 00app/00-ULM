/**
 * Mechanical-truth invariants — run in CI via `npm run test:mechanical-truth`.
 * Guards against fabricated scrape defaults and fake stream £ on an empty guest wall.
 */
import { TRUTH_2026_JULY } from '@/lib/brains/constants'
import { filterEpcRowsByHouseNumber } from '@/lib/intelligence/epcAddressMatch'
import { mapEpcPropertyTypeToHomeTypeHint } from '@/lib/epc/mapEpcToProfileHints'
import { JOURNEY_ORDER, type JourneyId } from '@/lib/journeys'
import { UK_2026_MONEY_LEAD } from '@/lib/scraper/uk2026Defaults'
import type { ScrapedDataPoint } from '@/lib/scraper/sources'
import { buildZoneViewModel } from '@/lib/zone/buildZoneViewModel'
import { ROCK_HABITS } from '@/lib/rock/habitsCatalog'
import {
  habitTopicConflictsWithOfferUrl,
  resolveRockHabitLearnUrl,
  rockHabitProviderMatchesUrl,
} from '@/lib/rock/resolveRockHabitLearnUrl'
import { headlineFromRockHabit, headlineFromRockHabitForSoloFocus, resolveRockHabitDisplayProse } from '@/lib/soloFocusCopy'
import {
  issueSessionRestoreProof,
  resolveUserIdFromRestoreProof,
  verifySessionRestoreProof,
} from '@/lib/sessionRestoreProof'
import { computingJourneyTitle, journeyHasStreamData } from '@/lib/zone/mechanicalTruth'

export type MechanicalTruthEvalResult = {
  ok: boolean
  failures: string[]
}

function emptyJourneyAnswers(): Record<JourneyId, Record<string, string>> {
  return Object.fromEntries(JOURNEY_ORDER.map((j) => [j, {}])) as Record<
    JourneyId,
    Record<string, string>
  >
}

function assertJuly2026CapLock(failures: string[]): void {
  if (TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP !== 1862) {
    failures.push(`TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP must be 1862 (got ${TRUTH_2026_JULY.PRICE_CAP_TYPICAL_GBP})`)
  }
}

function assertEpcHouseNumberFilter(failures: string[]): void {
  const rows = [
    { address: '12 Example Street, Littlehampton' },
    { address: '14 Example Street, Littlehampton' },
    { address: 'FLAT 2, 12 HIGH STREET' },
  ] as Record<string, unknown>[]
  const hit12 = filterEpcRowsByHouseNumber(rows, '12')
  if (hit12.length !== 2) {
    failures.push(`EPC house filter: expected 2 rows for "12" (got ${hit12.length})`)
  }
  const hit14 = filterEpcRowsByHouseNumber(rows, '14')
  if (hit14.length !== 1) {
    failures.push(`EPC house filter: expected 1 row for "14" (got ${hit14.length})`)
  }
  if (filterEpcRowsByHouseNumber(rows, '').length !== 3) {
    failures.push('EPC house filter: empty token must return all rows')
  }
}

function assertEpcHomeTypeHint(failures: string[]): void {
  if (mapEpcPropertyTypeToHomeTypeHint('Flat') !== 'FLAT') {
    failures.push('mapEpcPropertyTypeToHomeTypeHint(Flat) must return FLAT')
  }
  if (mapEpcPropertyTypeToHomeTypeHint('Detached house') !== 'HOUSE') {
    failures.push('mapEpcPropertyTypeToHomeTypeHint(Detached house) must return HOUSE')
  }
}

function assertUk2026DefaultsHonest(failures: string[]): void {
  for (const jid of JOURNEY_ORDER) {
    const row = UK_2026_MONEY_LEAD[jid]
    if (row.money_value !== 0) {
      failures.push(`UK_2026_MONEY_LEAD.${jid}.money_value must be 0 (got ${row.money_value})`)
    }
    if (row.carbon_value !== 0) {
      failures.push(`UK_2026_MONEY_LEAD.${jid}.carbon_value must be 0 (got ${row.carbon_value})`)
    }
  }
}

function assertEmptyStreamFlags(failures: string[]): void {
  const emptyOpts = { neonJourneyResearch: {}, scraped: {} }
  for (const jid of JOURNEY_ORDER) {
    if (journeyHasStreamData(jid, emptyOpts)) {
      failures.push(`journeyHasStreamData(${jid}) must be false with empty neon/scraped`)
    }
  }
}

function assertGuestVoidViewModel(failures: string[]): void {
  const vm = buildZoneViewModel({
    profile: {},
    journeyAnswers: emptyJourneyAnswers(),
    scraped: {},
    neonJourneyResearch: {},
  })

  for (const journey of vm.journeys) {
    if ((journey.moneyGbp ?? 0) > 0) {
      failures.push(
        `guest void: journey ${journey.journey_key} moneyGbp=${journey.moneyGbp} — expected 0 without profile/stream`
      )
    }
  }
}

function assertNeonStreamUnlocksHome(failures: string[]): void {
  const neonJourneyResearch = {
    home: {
      savingGbp: 420,
      architectProse: null,
      agentHeadline: 'loft insulation could save around £420 a year',
    },
  }
  if (!journeyHasStreamData('home', { neonJourneyResearch, scraped: {} })) {
    failures.push('neon home savingGbp must set journeyHasStreamData(home) true')
  }

  const vm = buildZoneViewModel({
    profile: { postcode: 'SW1A1AA' },
    journeyAnswers: emptyJourneyAnswers(),
    scraped: {},
    neonJourneyResearch,
  })
  const home = vm.journeys.find((j) => j.journey_key === 'home')
  if (!home) {
    failures.push('neon fixture: home journey missing from view model')
    return
  }
  if ((home.moneyGbp ?? 0) < 420) {
    failures.push(`neon fixture: home moneyGbp expected ≥420 (got ${home.moneyGbp})`)
  }
  if (home.title?.startsWith('COMPUTING')) {
    failures.push('neon fixture: home title must not be COMPUTING when neon stream exists')
  }
}

function assertComputingTitleHelper(failures: string[]): void {
  const title = computingJourneyTitle('travel')
  if (!title.startsWith('COMPUTING')) {
    failures.push(`computingJourneyTitle(travel) must start with COMPUTING (got "${title}")`)
  }
}

function assertAllJourneysOnWall(failures: string[]): void {
  const vm = buildZoneViewModel({
    profile: { postcode: 'M11AA' },
    journeyAnswers: emptyJourneyAnswers(),
    scraped: {},
    neonJourneyResearch: {},
  })
  if (vm.journeys.length !== JOURNEY_ORDER.length) {
    failures.push(
      `buildZoneViewModel must surface ${JOURNEY_ORDER.length} journeys (got ${vm.journeys.length})`
    )
  }
  for (const jid of JOURNEY_ORDER) {
    if (!vm.journeys.some((j) => j.journey_key === jid)) {
      failures.push(`buildZoneViewModel missing journey tile: ${jid}`)
    }
  }
}

function assertUk2026ScrapedShapeNotStream(failures: string[]): void {
  const scraped: Partial<Record<JourneyId, ScrapedDataPoint>> = {}
  for (const jid of JOURNEY_ORDER) {
    const lead = UK_2026_MONEY_LEAD[jid]
    scraped[jid] = {
      journey_key: jid,
      scraped_at: new Date(0).toISOString(),
      money_value: lead.money_value,
      carbon_value: lead.carbon_value,
    }
    if (journeyHasStreamData(jid, { scraped, neonJourneyResearch: {} })) {
      failures.push(`UK_2026 default scraped row must not count as stream for ${jid}`)
    }
  }
}

function assertScrapedPositiveMoneyIsStream(failures: string[]): void {
  const scraped: Partial<Record<JourneyId, ScrapedDataPoint>> = {
    travel: {
      journey_key: 'travel',
      scraped_at: new Date().toISOString(),
      money_value: 240,
      carbon_value: 120,
      deep_content_tip: 'rail instead of short-haul flight',
    },
  }
  if (!journeyHasStreamData('travel', { scraped, neonJourneyResearch: {} })) {
    failures.push('positive scraped money_value must set journeyHasStreamData(travel) true')
  }
}

function assertSessionRestoreProof(failures: string[]): void {
  const prev = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'test-session-secret-min-16-chars'
  try {
    const uid = '11111111-1111-4111-8111-111111111111'
    const proof = issueSessionRestoreProof(uid)
    if (!proof) {
      failures.push('issueSessionRestoreProof must return proof when SESSION_SECRET is set')
      return
    }
    if (!verifySessionRestoreProof(uid, proof)) {
      failures.push('verifySessionRestoreProof must accept freshly issued proof')
    }
    if (resolveUserIdFromRestoreProof(proof) !== uid) {
      failures.push('resolveUserIdFromRestoreProof must return uid for valid proof')
    }
    if (verifySessionRestoreProof('22222222-2222-4222-8222-222222222222', proof)) {
      failures.push('verifySessionRestoreProof must reject wrong user_id')
    }
    if (verifySessionRestoreProof(uid, `${proof}x`)) {
      failures.push('verifySessionRestoreProof must reject tampered proof')
    }
  } finally {
    if (prev === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = prev
  }
}

function assertRockHabitOfferAlignment(failures: string[]): void {
  for (const habit of ROCK_HABITS) {
    const url = resolveRockHabitLearnUrl(habit)
    if (!url.startsWith('https://')) {
      failures.push(`Rock habit ${habit.slug}: offer URL must be https (got ${url})`)
    }
    if (habitTopicConflictsWithOfferUrl(habit, url)) {
      failures.push(`Rock habit ${habit.slug}: offer URL topic conflicts with habit copy (${url})`)
    }
    if (!rockHabitProviderMatchesUrl(habit, url)) {
      failures.push(
        `Rock habit ${habit.slug}: provider "${habit.provider_name}" does not match offer host (${url})`
      )
    }
  }

  const ebike = ROCK_HABITS.find((h) => h.slug === 'e-bike-scheme')
  if (ebike) {
    const url = resolveRockHabitLearnUrl(ebike)
    if (/eurostar/i.test(url)) {
      failures.push('e-bike-scheme must not resolve to Eurostar')
    }
    const headline = headlineFromRockHabit(ebike.title, ebike.insight)
    const dup = headline.toLowerCase().match(/e-?bike\s+schemes/gi)
    if (dup && dup.length > 1) {
      failures.push(`e-bike-scheme headline must not duplicate title tokens (got "${headline}")`)
    }
    const prose = resolveRockHabitDisplayProse({
      title: ebike.title,
      insight: ebike.insight,
      headline: headlineFromRockHabitForSoloFocus(ebike.title, ebike.insight),
      journeyId: ebike.journey_key,
      moneyGbp: ebike.money_gbp,
      carbonKg: ebike.carbon_kg,
      sourceDisplayName: ebike.provider_name,
    })
    if (/\b(?:flight|short-haul|booking one trip by rail)\b/i.test(prose.lead)) {
      failures.push(`e-bike-scheme Solo Focus lead must not use holidays flight copy (got "${prose.lead}")`)
    }
    const insightNorm = ebike.insight.trim().toLowerCase()
    if (prose.lead.toLowerCase().startsWith(insightNorm.slice(0, Math.min(40, insightNorm.length)))) {
      failures.push('e-bike-scheme Solo Focus lead must not repeat headline insight verbatim')
    }
  }
}

/** Run all mechanical-truth checks. Pure — safe in CI without DB. */
export function runMechanicalTruthEval(): MechanicalTruthEvalResult {
  const failures: string[] = []
  assertUk2026DefaultsHonest(failures)
  assertJuly2026CapLock(failures)
  assertEpcHouseNumberFilter(failures)
  assertEpcHomeTypeHint(failures)
  assertEmptyStreamFlags(failures)
  assertComputingTitleHelper(failures)
  assertGuestVoidViewModel(failures)
  assertNeonStreamUnlocksHome(failures)
  assertAllJourneysOnWall(failures)
  assertUk2026ScrapedShapeNotStream(failures)
  assertScrapedPositiveMoneyIsStream(failures)
  assertRockHabitOfferAlignment(failures)
  assertSessionRestoreProof(failures)
  return { ok: failures.length === 0, failures }
}
