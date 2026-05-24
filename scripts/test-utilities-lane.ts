#!/usr/bin/env npx tsx
/**
 * Utilities lane smoke — unlock rules, question queue, free API registry.
 * Usage: npx tsx scripts/test-utilities-lane.ts
 */
import assert from 'node:assert/strict'
import {
  isUtilitiesZoneCardUnlocked,
  readProfilePowerType,
} from '../lib/zone/utilitiesZoneUnlock'
import {
  getSoloFocusNextQuestion,
  mergeProfileSeededAnswers,
} from '../lib/zone/questionHandler'
import { getJourneyQuestions } from '../lib/journeys'
import {
  readHomePowerFromGenome,
  UTILITIES_FREE_API_REGISTRY,
} from '../lib/data/utilitiesFreeApis'
import { buildUtilitiesLaneLockBlock } from '../lib/intelligence/utilitiesLaneRules'
import { isAllowedResearchCategory } from '../lib/intelligence/researchCategories'

function ok(cond: boolean, msg: string) {
  assert.ok(cond, msg)
}

// Unlock
ok(!isUtilitiesZoneCardUnlocked({}), 'utilities locked without power type')
ok(isUtilitiesZoneCardUnlocked({ home_power: 'GAS' }), 'utilities unlocked with GAS')
ok(readProfilePowerType({ homePower: 'electric' }) === 'ELECTRIC', 'homePower alias')

// Journey registry — no home_power question on utilities tile
const utilQs = getJourneyQuestions('utilities').map((q) => q.id)
ok(!utilQs.includes('home_power'), 'utilities registry excludes home_power')
ok(utilQs.includes('tariff_type'), 'utilities has tariff_type')

// Lane lock copy
const lane = buildUtilitiesLaneLockBlock('MIX')
ok(lane.includes('utilities'), 'lane block names domain')
ok(lane.includes('MIX'), 'lane block includes power type')

// Category routing
ok(isAllowedResearchCategory('utilities'), 'utilities is allowed research category')
ok(isAllowedResearchCategory('bills'), 'bills extended category allowed')
ok(!isAllowedResearchCategory('solarx'), 'fake category rejected')

// Genome read
ok(
  readHomePowerFromGenome({
    journey_answers_jsonb: { utilities: { home_power: 'GAS' } },
  }) === 'GAS',
  'genome nested utilities.home_power'
)

// Free API registry
ok(UTILITIES_FREE_API_REGISTRY.length >= 3, 'free API registry populated')
ok(
  UTILITIES_FREE_API_REGISTRY.every((r) => r.auth === 'none'),
  'all utilities free APIs are keyless'
)

// mergeProfileSeededAnswers is client-only (localStorage) — test shape only when storage mocked:
// Here we only verify it does not throw on server with empty storage
const merged = mergeProfileSeededAnswers('utilities', { tariff_type: 'FIXED' })
ok(typeof merged === 'object', 'mergeProfileSeededAnswers returns object')

const next = getSoloFocusNextQuestion('utilities', { home_power: 'GAS', tariff_type: '' })
ok(next?.id === 'tariff_type' || next?.id === 'supplier_switch', 'solo focus skips answered seed paths')

console.log('[test-utilities-lane] OK', {
  utilQs,
  freeApis: UTILITIES_FREE_API_REGISTRY.map((a) => a.id),
})
