#!/usr/bin/env node
/**
 * Validates schema JSON parses and minimal fixture matches required top-level structure.
 * Run: node scripts/validate-firecrawl-zone-schema.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const schemaPath = path.join(root, 'schemas/firecrawl-zone-research.v2.json')
const fixturePath = path.join(root, 'schemas/fixtures/firecrawl-zone-research.v2.minimal.json')

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
}

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
assert(schema.properties?.schema_version?.const === '2.0.0', 'schema_version const')

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
assert(fixture.schema_version === '2.0.0', 'fixture schema_version')
assert(fixture.zero_zero_zone_dashboard, 'fixture.zero_zero_zone_dashboard')
assert(fixture.homeenergyscotland_grant_loan_information, 'fixture.homeenergyscotland')

const lock = fixture.zero_zero_zone_dashboard.april_2026_economy_lock_constants
assert(typeof lock.electricity_unit_gbp_per_kwh === 'number', 'elec unit')
assert(typeof lock.gas_unit_gbp_per_kwh === 'number', 'gas unit')
assert(Array.isArray(lock.citations) && lock.citations.length >= 1, 'citations')

const journeys = fixture.zero_zero_zone_dashboard.journey_calculation_formulas
assert(Array.isArray(journeys) && journeys.length === 9, 'nine journeys')

const keys = new Set(journeys.map((j) => j.journey_key))
const expected = ['home', 'travel', 'food', 'shopping', 'money', 'carbon', 'tech', 'waste', 'holidays']
for (const k of expected) {
  assert(keys.has(k), `missing journey_key ${k}`)
}

console.log('OK: firecrawl-zone-research.v2 schema + minimal fixture')
