/**
 * CI gate — Lifestyle, the 13th journey (PRD v4, Z5). No DB, no network.
 *
 *  - Lifestyle is a real journey: id, label, colour, icon, 3 onboarding questions, 3 loop questions.
 *  - It reaches the Zone: eligible lifestyle actions become cards and fill a rail and a filter.
 *  - Every lifestyle card is sourced, dated and free of health or body wording.
 *  - The existing 12 journeys are unchanged: same order, same questions, same loop bank, and the
 *    same eligible actions as a library without the lifestyle entries.
 *
 * Run: npm run test:lifestyle
 */

import {
  JOURNEY_IDS,
  JOURNEY_LABELS,
  JOURNEY_COLORS,
  JOURNEYS,
  QUESTIONS_PER_JOURNEY,
  isValidJourneyId,
  type JourneyId,
} from '../lib/journeys'
import { LOOP_QUESTION_BANK, beatsForJourney } from '../lib/zone/loopQuestions'
import { ZONE_ACTIONS } from '../lib/actions/actionLibrary'
import { eligibleActions, selectActionsForProfile } from '../lib/actions/selectActions'
import type { ActionProfile } from '../lib/actions/actionTypes'
import { actionsToJourneyCards } from '../lib/actions/actionCards'
import { journeyToRecCard } from '../lib/zone/recCardFromZone'
import { buildZoneRails } from '../lib/zone/rails'
import { matchesFilters, parseZoneFilters } from '../lib/zone/filters'
import { resolveZoneCategoryIconKind } from '../app/components/ui/ZoneCategoryIcon'
import { insightFromRecCard } from '../lib/zone/insightCard'
import { CATEGORY_FACTS } from '../lib/household/factRegistry'

const failures: string[] = []
let checks = 0
function check(name: string, cond: boolean, detail?: string) {
  checks += 1
  if (!cond) failures.push(detail ? `${name} — ${detail}` : name)
}

const ORIGINAL_12: JourneyId[] = ['home', 'utilities', 'solar', 'travel', 'holidays', 'food', 'shopping', 'money', 'tech', 'water', 'waste', 'carbon']
const ORIGINAL_LOOP_IDS = [
  'travel_rail_vs_flight', 'travel_ev_commute', 'holidays_local_vs_longhaul', 'holidays_train_not_plane',
  'food_plant_shift', 'food_waste_cut', 'money_ev_swap', 'money_smart_tariff', 'utilities_supplier_switch',
  'home_heat_pump', 'home_loft_insulate', 'solar_roof_fit', 'shopping_repair_first', 'tech_standby_off',
  'water_meter_save', 'waste_compost', 'carbon_offset_cut',
]
const HEALTH_WORDS = /\b(?:health|healthy|unhealthy|weight|fit(?:ness)?|body|diet|calorie|calories|obes\w*|lazy|waste of money|too much)\b/i
const LIFESTYLE_IDS = ZONE_ACTIONS.filter((a) => a.bucket === 'lifestyle').map((a) => a.id)

// ── the journey itself ───────────────────────────────────────────────────────────────────────
check('13 journeys, lifestyle last', JOURNEY_IDS.length === 13 && JOURNEY_IDS[12] === 'lifestyle')
check('the original 12 keep their order', ORIGINAL_12.every((j, i) => JOURNEY_IDS[i] === j))
check('lifestyle is a valid journey id', isValidJourneyId('lifestyle'))
check('lifestyle has a label', JOURNEY_LABELS.lifestyle === 'Lifestyle')
check('lifestyle has a colour', typeof JOURNEY_COLORS.lifestyle === 'string' && JOURNEY_COLORS.lifestyle.length > 0)
check('lifestyle has its own icon', resolveZoneCategoryIconKind('lifestyle') === 'lifestyle')
const qs = JOURNEYS.lifestyle.questions
check(`lifestyle has ${QUESTIONS_PER_JOURNEY} onboarding questions`, qs.length === QUESTIONS_PER_JOURNEY)
check('lifestyle onboarding questions are choice answers', qs.every((q) => q.type === 'options' && (q.options?.length ?? 0) >= 2))
check('no health or body words in lifestyle questions', qs.every((q) => !HEALTH_WORDS.test(q.label)), qs.map((q) => q.label).join(' | '))

// ── loop questions ───────────────────────────────────────────────────────────────────────────
const beats = beatsForJourney('lifestyle')
check('3 lifestyle loop questions', beats.length === 3, beats.map((b) => b.questionId).join(','))
check(
  'loop questions are the spec ids',
  ['lifestyle_memberships', 'lifestyle_visits', 'lifestyle_eat_out'].every((id) => beats.some((b) => b.questionId === id))
)
check('loop questions are choice answers', beats.every((b) => b.options.length === 3))
check('no health or body words in loop questions', beats.every((b) => !HEALTH_WORDS.test(`${b.question} ${b.options.map((o) => o.ariaLabel ?? o.label).join(' ')}`)))
check('loop question ids are unique', new Set(LOOP_QUESTION_BANK.map((b) => b.questionId)).size === LOOP_QUESTION_BANK.length)
const existingLoop = LOOP_QUESTION_BANK.filter((b) => b.journeyKeys[0] !== 'lifestyle').map((b) => b.questionId)
check('the existing 17 loop questions are unchanged and in order', JSON.stringify(existingLoop) === JSON.stringify(ORIGINAL_LOOP_IDS), existingLoop.join(','))
check('household registry asks lifestyle facts through these questions', ['lifestyle_memberships', 'lifestyle_visits', 'lifestyle_eat_out'].every((q) => CATEGORY_FACTS.lifestyle.some((f) => f.questionId === q)))

// ── library actions ──────────────────────────────────────────────────────────────────────────
check('at least 4 lifestyle actions', LIFESTYLE_IDS.length >= 4, LIFESTYLE_IDS.join(','))
for (const a of ZONE_ACTIONS.filter((x) => x.bucket === 'lifestyle')) {
  check(`${a.id}: https url`, a.url.startsWith('https://'))
  check(`${a.id}: named source`, a.source.trim().length > 8)
  check(`${a.id}: verified date`, /^\d{4}-\d{2}-\d{2}$/.test(a.verifiedOn))
  check(`${a.id}: no £ without a sourced figure`, a.valueGbp === 0 || new RegExp(`£\\s?${a.valueGbp}`).test(`${a.detail} ${a.source}`))
  check(`${a.id}: no kg without a published factor`, a.valueKg === 0)
  check(`${a.id}: no health or judgement words`, !HEALTH_WORDS.test(`${a.action} ${a.detail}`), `${a.action} ${a.detail}`)
}

// ── it reaches the Zone ──────────────────────────────────────────────────────────────────────
const MEMBER: ActionProfile = {
  tenure: 'RENTER',
  financial: 'GETTING_BY',
  household: 'ALONE',
  employment: 'EMPLOYED',
  age: 'MID',
  heating: 'GAS',
  transport: 'PUBLIC',
  wash: 'SHOWER',
  country: 'ENGLAND',
  loopAnswers: { lifestyle_memberships: 'GYM', lifestyle_visits: 'NONE OR ONCE', takeaway_subscription: 'YES', pet_owner: 'CAT' },
}
const eligible = eligibleActions(MEMBER, { month: 10 }).filter((a) => a.bucket === 'lifestyle').map((a) => a.id)
check('a low-use member gets the pause or downgrade action', eligible.includes('membership-pause-or-downgrade'))
check('a takeaway subscriber gets the takeaway check', eligible.includes('takeaway-subscription-check'))
check('a pet owner gets the pet insurance check', eligible.includes('pet-insurance-renewal-check'))
check('lifestyle makes the 12-card wall for a member on a budget', selectActionsForProfile(MEMBER, { month: 10 }).some((a) => a.bucket === 'lifestyle'))

const UNANSWERED: ActionProfile = { ...MEMBER, loopAnswers: null }
const hidden = eligibleActions(UNANSWERED, { month: 10 }).map((a) => a.id)
check('membership action waits for the visits answer', !hidden.includes('membership-pause-or-downgrade'))
check('pet action waits for the pet answer', !hidden.includes('pet-insurance-renewal-check'))
check('a frequent visitor is not told to downgrade', !eligibleActions({ ...MEMBER, loopAnswers: { lifestyle_visits: 'OFTEN' } }, { month: 10 }).some((a) => a.id === 'membership-pause-or-downgrade'))

const ctx = { facts: { household: 'ALONE', place: 'Testville' } }
const cards = actionsToJourneyCards(eligibleActions(MEMBER, { month: 10 }).filter((a) => a.bucket === 'lifestyle'))
  .map((c) => journeyToRecCard(c, ctx))
  .filter((c): c is NonNullable<typeof c> => c != null)
check('lifestyle actions become Zone cards', cards.length >= 3, String(cards.length))
check('lifestyle cards are filed under lifestyle', cards.every((c) => c.category === 'lifestyle'))
check('lifestyle cards show no unsourced £', cards.every((c) => c.savingGbpPerYear === null && (c.typicalSaving === null || c.typicalSaving.source.name.length > 0)))
const { rails } = buildZoneRails(cards, [])
check('lifestyle gets its own Zone rail', rails.some((r) => r.kind === 'category' && r.category === 'lifestyle'))
const filter = parseZoneFilters({ category: 'lifestyle' })
check('the Lifestyle filter is accepted', filter.category === 'lifestyle')
check('the Lifestyle filter keeps lifestyle cards', cards.every((c) => matchesFilters(c, filter)))
check('every lifestyle card meets the InsightCard contract', cards.every((c) => insightFromRecCard(c).ok))

// ── the existing 12 are unchanged ────────────────────────────────────────────────────────────
const withoutLifestyle = ZONE_ACTIONS.filter((a) => a.bucket !== 'lifestyle')
const PROFILES: ActionProfile[] = [
  MEMBER,
  UNANSWERED,
  { tenure: 'OWNER', financial: 'DOING_OK', household: 'COUPLE', heating: 'GAS', transport: 'CAR', country: 'ENGLAND' },
  { tenure: 'RENTER', financial: 'TIGHT', household: 'FAMILY', children: 'BOTH', employment: 'BETWEEN_JOBS', heating: 'ELECTRIC', country: 'WALES' },
  {},
]
for (const [i, p] of PROFILES.entries()) {
  for (const month of [1, 6, 10]) {
    const now = eligibleActions(p, { month }).filter((a) => a.bucket !== 'lifestyle').map((a) => a.id)
    const before = eligibleActions(p, { month, library: withoutLifestyle }).map((a) => a.id)
    check(`profile ${i}, month ${month}: the 12 journeys' eligible actions are unchanged`, JSON.stringify(now) === JSON.stringify(before))
  }
}
for (const j of ORIGINAL_12) {
  check(`${j}: still has its 3 onboarding questions`, JOURNEYS[j].questions.length === 3)
}

if (failures.length) {
  console.error(`[lifestyle] FAIL ${failures.length}/${checks}`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`[lifestyle] OK — ${checks} checks passed (${LIFESTYLE_IDS.length} lifestyle actions)`)
