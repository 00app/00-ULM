/**
 * Raw inputs → one `Household` of sourced facts. Pure: no database, network or clock reads
 * (pass `now`), so the same code serves real users, guests, tests and the synthetic dataset.
 *
 * Precedence when two inputs give the same fact: higher tier wins (bills and bank over what you
 * told us over public data), then the newer as-of. A stored `household_facts` row competes on the
 * same terms, so a user correcting a fact on "What we know" (Z7) wins over their old answer.
 */

import type { BankAnalysis } from '@/lib/bank/analysis'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import { CATEGORY_FACTS, homeCategoryForFact, isHouseholdFactCategory } from '@/lib/household/factRegistry'
import {
  TOLD_US_SOURCE,
  isIsoDateLike,
  tierForSource,
  type AccountInput,
  type Confidence,
  type FactSource,
  type FactValue,
  type HouseholdFact,
  type HouseholdFactCategory,
  type HouseholdIdentity,
  type Level,
  type StoredFactInput,
  type Tier,
} from '@/lib/household/records'

export type HouseholdInputs = {
  identity: HouseholdIdentity
  postcode: string | null
  /** Onboarding profile. camelCase (client) and snake_case (guest_sessions, user_genome) both accepted. */
  profile: Record<string, unknown> | null
  /** When the profile answers were last saved; the best as-of we have for them. */
  profileAsOf: string | null
  /** journeyId → questionId → answer, from user_profiles.journey_answers_jsonb or guest_sessions. */
  journeyAnswers: Record<string, Record<string, unknown>> | null
  journeyAnswersAsOf: string | null
  /** LOOP_QUESTION_BANK and card-question answers, questionId → answer value. */
  loopAnswers: Record<string, string> | null
  loopAnswersAsOf: string | null
  property: PropertyIntelligence | null
  /** Signed-in (or synthetic) only; ignored for guests. */
  accounts: AccountInput[]
  /** Signed-in (or synthetic) only; ignored for guests. */
  bank: { analysis: BankAnalysis; asOf: string } | null
  storedFacts: StoredFactInput[]
}

export type Household = {
  identity: HouseholdIdentity
  postcode: string | null
  /** field_key → best fact. Unknown keys are absent. */
  facts: Record<string, HouseholdFact>
  accounts: AccountInput[]
  bankSource: 'none' | 'sample' | 'live'
  /** Raw answers kept for action gates (`gates.loop` reads questionId → value). */
  answers: Record<string, string>
  country: string | null
}

export const EPC_SOURCE: FactSource = {
  kind: 'public',
  name: 'EPC register',
  url: 'https://find-energy-certificate.service.gov.uk/',
}
export const FLOOD_SOURCE: FactSource = {
  kind: 'public',
  name: 'Environment Agency flood monitoring',
  url: 'https://check-for-flooding.service.gov.uk/',
}
export const PVGIS_SOURCE: FactSource = {
  kind: 'public',
  name: 'PVGIS (EU Joint Research Centre)',
  url: 'https://re.jrc.ec.europa.eu/pvg_tools/en/',
}

const PROFILE_KEYS: Array<[factKey: string, aliases: string[]]> = [
  ['tenure', ['homeOwnership', 'home_ownership']],
  ['financial_pressure', ['financialPressure', 'financial_pressure']],
  ['household', ['livingSituation', 'household']],
  ['children', ['children']],
  ['employment_status', ['employmentStatus', 'employment_status']],
  ['age_group', ['age', 'age_group']],
  ['power_type', ['powerType', 'home_power', 'profile_home_power']],
  ['supplier', ['energySupplier', 'energy_supplier']],
  ['transport', ['transport', 'transport_baseline']],
  ['wash_preference', ['washPreference', 'wash_preference']],
]

/** Loop questions whose answer fills a registry fact (from §9 `questionId`s). */
const LOOP_TO_FACT: Record<string, string> = Object.fromEntries(
  Object.values(CATEGORY_FACTS)
    .flat()
    .filter((f) => f.questionId)
    .map((f) => [f.questionId as string, f.key])
)

const REGISTRY_KEYS = new Set(Object.values(CATEGORY_FACTS).flat().map((f) => f.key))

function cleanToken(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 && s.length <= 80 ? s : null
}

function levelFor(key: string, fallback: Level): Level {
  for (const list of Object.values(CATEGORY_FACTS)) {
    const spec = list.find((f) => f.key === key)
    if (spec) return spec.level
  }
  return fallback
}

function categoryFor(key: string, fallback: HouseholdFactCategory | 'profile' = 'profile') {
  return homeCategoryForFact(key) ?? fallback
}

type Draft = {
  key: string
  value: FactValue
  unit?: string | null
  source: FactSource
  asOf: string
  confidence: Confidence
  confidenceReason: string
  tier?: Tier
  level?: Level
}

function better(a: HouseholdFact, b: HouseholdFact): HouseholdFact {
  if (a.tier !== b.tier) return a.tier > b.tier ? a : b
  return Date.parse(a.asOf) >= Date.parse(b.asOf) ? a : b
}

export function buildHousehold(inputs: HouseholdInputs, now: Date = new Date()): Household {
  const facts: Record<string, HouseholdFact> = {}
  const signedIn = inputs.identity.kind !== 'guest'
  const fallbackAsOf = now.toISOString()

  const put = (d: Draft) => {
    if (d.value === null || d.value === undefined) return
    if (typeof d.value === 'string' && d.value.trim() === '') return
    if (Array.isArray(d.value) && d.value.length === 0) return
    const fact: HouseholdFact = {
      key: d.key,
      category: categoryFor(d.key),
      value: d.value,
      unit: d.unit ?? null,
      source: d.source,
      asOf: d.asOf,
      confidence: d.confidence,
      confidenceReason: d.confidenceReason,
      tier: d.tier ?? tierForSource(d.source.kind),
      level: d.level ?? levelFor(d.key, 'L1'),
    }
    const prev = facts[d.key]
    facts[d.key] = prev ? better(prev, fact) : fact
  }

  // ── L1: onboarding profile ────────────────────────────────────────────────────────────────
  const profile = inputs.profile ?? {}
  const profileAsOf = inputs.profileAsOf ?? fallbackAsOf
  const toldUs = (key: string, value: FactValue, asOf = profileAsOf, level?: Level) =>
    put({
      key,
      value,
      source: TOLD_US_SOURCE,
      asOf,
      confidence: 'medium',
      confidenceReason: 'From what you told us.',
      level,
    })

  for (const [key, aliases] of PROFILE_KEYS) {
    const value = aliases.map((a) => cleanToken(profile[a])).find(Boolean)
    if (value) toldUs(key, value)
  }

  const household = cleanToken(facts.household?.value)
  if (household) {
    put({
      key: 'single_occupier',
      value: household.toUpperCase() === 'ALONE',
      source: { kind: 'derived', name: 'From who you told us you live with', url: null },
      asOf: profileAsOf,
      confidence: 'medium',
      confidenceReason: 'Worked out from what you told us.',
      tier: 2,
    })
  }
  const employment = cleanToken(facts.employment_status?.value)?.toUpperCase()
  if (employment) {
    put({
      key: 'student',
      value: employment === 'STUDENT',
      source: { kind: 'derived', name: 'From your work status', url: null },
      asOf: profileAsOf,
      confidence: 'medium',
      confidenceReason: 'Worked out from what you told us.',
      tier: 2,
    })
  }
  const age = cleanToken(facts.age_group?.value)?.toUpperCase()
  const pressure = cleanToken(facts.financial_pressure?.value)?.toUpperCase()
  const concession = [age === 'RETIRED', employment === 'STUDENT' || employment === 'BETWEEN_JOBS', pressure === 'TIGHT']
  if (concession.some(Boolean) || (age && employment && pressure)) {
    put({
      key: 'leisure_concession_eligible',
      value: concession.some(Boolean),
      source: { kind: 'derived', name: 'From your age, work and money answers', url: null },
      asOf: profileAsOf,
      confidence: 'low',
      confidenceReason: 'Councils set their own concession rules; this is a likely match, not a decision.',
      tier: 2,
    })
  }

  // ── L1: onboarding journey answers ────────────────────────────────────────────────────────
  const journeyAsOf = inputs.journeyAnswersAsOf ?? profileAsOf
  const journeyEntries = Object.entries(inputs.journeyAnswers ?? {})
  // utilities owns tariff_type; money repeats the question, so read it last as a fallback.
  journeyEntries.sort(([a], [b]) => (a === 'money' ? 1 : 0) - (b === 'money' ? 1 : 0))
  const answers: Record<string, string> = {}
  for (const [, qa] of journeyEntries) {
    if (!qa || typeof qa !== 'object') continue
    for (const [qid, raw] of Object.entries(qa)) {
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : cleanToken(raw)
      if (value === null) continue
      if (typeof value === 'string' && !(qid in answers)) answers[qid] = value
      if (REGISTRY_KEYS.has(qid) && !facts[qid]) toldUs(qid, value, journeyAsOf, 'L1')
    }
  }
  const takeaway = cleanToken(answers.takeaway_subscription)?.toUpperCase()
  if (takeaway === 'YES' || takeaway === 'NO') toldUs('takeaway_app_subscription', takeaway === 'YES', journeyAsOf, 'L1')
  const ev = cleanToken(answers.ev_hybrid)?.toUpperCase()
  if (ev) toldUs('has_ev', ev === 'EV' || ev === 'HYBRID', journeyAsOf, 'L1')
  const power = cleanToken(facts.power_type?.value)?.toUpperCase()
  if (power && power.includes('HEAT')) toldUs('has_heat_pump', true, profileAsOf, 'L1')

  // ── L2: loop and card questions ───────────────────────────────────────────────────────────
  const loopAsOf = inputs.loopAnswersAsOf ?? fallbackAsOf
  for (const [qid, raw] of Object.entries(inputs.loopAnswers ?? {})) {
    const value = cleanToken(raw)
    if (!value) continue
    answers[qid] = value
    const key = LOOP_TO_FACT[qid]
    if (key) toldUs(key, value, loopAsOf, 'L2')
  }

  // ── L0: public data (property intelligence) ───────────────────────────────────────────────
  const property = inputs.property
  if (property) {
    const epc = property.epc
    if (epc?.found) {
      const asOf = isIsoDateLike(epc.lodgementDate) ? epc.lodgementDate : property.enrichedAt
      const matched = epc.addressMatched === true
      const confidence: Confidence = !matched ? 'low' : epc.isStale ? 'medium' : 'high'
      const reason = !matched
        ? 'From an EPC for a home on your postcode, not matched to your address.'
        : epc.isStale
          ? 'Your EPC is more than 10 years old.'
          : 'From the EPC for your address.'
      const epcFact = (key: string, value: string | undefined) =>
        value && put({ key, value, source: EPC_SOURCE, asOf, confidence, confidenceReason: reason, level: 'L0' })
      epcFact('epc_band', epc.currentEnergyRating)
      epcFact('epc_potential', epc.potentialEnergyRating)
      epcFact('walls', epc.wallsDescription)
      epcFact('loft', epc.roofDescription)
      epcFact('main_heating', epc.mainFuel)
    }
    if (property.flood?.found && property.flood.floodRiskZone) {
      put({
        key: 'flood_risk',
        value: property.flood.floodRiskZone,
        source: FLOOD_SOURCE,
        asOf: property.enrichedAt,
        confidence: 'medium',
        confidenceReason: 'From current flood alerts near your postcode, not a survey of your home.',
        level: 'L0',
      })
    }
    if (property.solar?.found && typeof property.solar.annualIrradianceKwhM2 === 'number') {
      put({
        key: 'irradiance',
        value: property.solar.annualIrradianceKwhM2,
        unit: 'kwh_m2_year',
        source: PVGIS_SOURCE,
        asOf: property.enrichedAt,
        confidence: 'high',
        confidenceReason: 'From PVGIS for your location.',
        level: 'L0',
      })
    }
  }

  // ── L3 / L4: accounts and bank (signed in only) ───────────────────────────────────────────
  const accounts = signedIn ? inputs.accounts.filter((a) => a.status === 'active') : []
  for (const a of accounts) {
    const source: FactSource =
      a.source === 'bank'
        ? { kind: 'bank', name: 'Your bank', url: null }
        : { kind: 'told_us', name: 'A bill you added', url: null }
    const confidence: Confidence = a.source === 'bank' ? 'high' : 'medium'
    const reason = a.source === 'bank' ? 'From your bank payments.' : 'From a bill or contract you added.'
    const acc = (key: string, value: FactValue | null | undefined, unit?: string, why = reason) =>
      value !== null &&
      value !== undefined &&
      put({ key, value, unit, source, asOf: a.updated_at, confidence, confidenceReason: why, level: 'L3' })

    switch (a.category) {
      case 'broadband':
        acc('broadband_provider', a.provider_name)
        acc('broadband_monthly_price', a.monthly_amount_pence, 'pence_month')
        acc('broadband_contract_end', a.contract_end_date, 'date')
        break
      case 'mobile':
        acc('mobile_monthly_price', a.monthly_amount_pence, 'pence_month')
        acc('mobile_contract_end', a.contract_end_date, 'date')
        break
      case 'energy_fix':
        acc('fix_end_date', a.contract_end_date, 'date')
        break
      case 'water':
        acc(
          'water_bill_year',
          a.monthly_amount_pence !== null ? a.monthly_amount_pence * 12 : null,
          'pence_year',
          `${reason} Monthly amount × 12.`
        )
        break
      case 'home_insurance':
        acc('home_insurance_renewal', a.renewal_date ?? a.contract_end_date, 'date')
        break
      case 'car_insurance':
        acc('car_insurance_renewal', a.renewal_date ?? a.contract_end_date, 'date')
        break
      case 'vehicle_tax':
        acc('vehicle_tax_due', a.renewal_date ?? a.contract_end_date, 'date')
        break
      case 'pet_insurance':
        acc('pet_insurance_renewal', a.renewal_date ?? a.contract_end_date, 'date')
        break
      case 'travel_insurance':
        acc('travel_insurance', a.renewal_date ? 'ANNUAL' : 'HAS_COVER')
        break
    }
  }

  // Energy: one direct debit total across electricity and gas, and the earliest fix end.
  const energy = accounts.filter((a) => a.category === 'electricity' || a.category === 'gas')
  const priced = energy.filter((a) => a.monthly_amount_pence !== null)
  if (priced.length > 0) {
    const bank = priced.every((a) => a.source === 'bank')
    put({
      key: 'energy_direct_debit',
      value: priced.reduce((s, a) => s + (a.monthly_amount_pence ?? 0), 0),
      unit: 'pence_month',
      source: bank ? { kind: 'bank', name: 'Your bank', url: null } : { kind: 'told_us', name: 'Bills you added', url: null },
      asOf: priced.map((a) => a.updated_at).sort().at(-1) as string,
      confidence: bank ? 'high' : 'medium',
      confidenceReason: bank ? 'From your bank payments.' : 'From the energy bills you added.',
      level: 'L3',
    })
  }
  const fixEnds = energy.map((a) => a.contract_end_date).filter(isIsoDateLike).sort()
  if (fixEnds.length > 0) {
    const a = energy.find((x) => x.contract_end_date === fixEnds[0]) as AccountInput
    put({
      key: 'fix_end_date',
      value: fixEnds[0],
      unit: 'date',
      source: a.source === 'bank' ? { kind: 'bank', name: 'Your bank', url: null } : { kind: 'told_us', name: 'A bill you added', url: null },
      asOf: a.updated_at,
      confidence: a.source === 'bank' ? 'high' : 'medium',
      confidenceReason: 'From your energy contract end date.',
      level: 'L3',
    })
  }

  // Lists: streaming services, memberships, subscriptions (accounts first, then bank).
  type Item = { name: string; monthlyPence: number | null; usesPerMonth?: number | null }
  const lists: Record<'streaming_services' | 'memberships' | 'subscriptions', { items: Item[]; sources: Draft[] }> = {
    streaming_services: { items: [], sources: [] },
    memberships: { items: [], sources: [] },
    subscriptions: { items: [], sources: [] },
  }
  for (const a of accounts) {
    const target =
      a.category === 'streaming' ? 'streaming_services' : a.category === 'membership' ? 'memberships' : a.category === 'subscription' ? 'subscriptions' : null
    if (!target) continue
    lists[target].items.push({
      name: a.provider_name ?? 'Unnamed',
      monthlyPence: a.monthly_amount_pence,
      ...(target === 'memberships' ? { usesPerMonth: a.uses_per_month ?? null } : {}),
    })
    lists[target].sources.push({
      key: target,
      value: [],
      source: a.source === 'bank' ? { kind: 'bank', name: 'Your bank', url: null } : { kind: 'told_us', name: 'Accounts you added', url: null },
      asOf: a.updated_at,
      confidence: a.source === 'bank' ? 'high' : 'medium',
      confidenceReason: a.source === 'bank' ? 'From your bank payments.' : 'From accounts you added.',
      level: target === 'memberships' ? 'L2' : 'L3',
    })
  }

  const bank = signedIn ? inputs.bank : null
  if (bank) {
    const sample = bank.analysis.source === 'sample'
    const bankSource: FactSource = sample
      ? { kind: 'sample', name: 'Sample bank data', url: null }
      : { kind: 'bank', name: 'Your bank', url: null }
    for (const p of bank.analysis.recurring) {
      if (p.category !== 'subscription') continue
      const target = /gym/i.test(p.displayName) ? 'memberships' : STREAMING.test(p.displayName) ? 'streaming_services' : 'subscriptions'
      const list = lists[target]
      if (list.items.some((i) => i.name.toLowerCase() === p.displayName.toLowerCase())) continue
      list.items.push({ name: p.displayName, monthlyPence: p.monthlyAmountPence, ...(target === 'memberships' ? { usesPerMonth: null } : {}) })
      list.sources.push({
        key: target,
        value: [],
        source: bankSource,
        asOf: bank.asOf,
        confidence: sample ? 'low' : 'high',
        confidenceReason: sample ? 'Sample data, not your real payments.' : 'From your bank payments.',
        tier: 3,
        level: 'L4',
      })
    }
  }
  for (const [key, { items, sources }] of Object.entries(lists)) {
    if (items.length === 0) continue
    // A list is only as sure as its weakest entry, and only as fresh as its newest.
    const weakest = [...sources].sort((x, y) => CONF_RANK[x.confidence] - CONF_RANK[y.confidence])[0]
    put({
      ...weakest,
      key,
      value: items as unknown as Record<string, unknown>[],
      unit: 'list',
      asOf: sources.map((s) => s.asOf).sort().at(-1) as string,
    })
    if (key === 'memberships') {
      const uses = items.filter((i) => typeof i.usesPerMonth === 'number')
      if (uses.length > 0) {
        put({
          ...weakest,
          key: 'membership_uses_per_month',
          value: uses.map((i) => ({ name: i.name, usesPerMonth: i.usesPerMonth })) as unknown as Record<string, unknown>[],
          unit: 'list',
          asOf: sources.map((s) => s.asOf).sort().at(-1) as string,
        })
      }
    }
  }

  // ── Stored household_facts rows (Z7 writes these) ─────────────────────────────────────────
  for (const row of inputs.storedFacts) {
    if (!row.field_key || row.value === null || row.value === undefined) continue
    put({
      key: row.field_key,
      value: row.value,
      unit: row.unit ?? null,
      source: { kind: row.source_kind, name: row.source_name, url: row.source_url },
      asOf: row.as_of,
      confidence: row.confidence,
      confidenceReason: row.confidence_reason ?? defaultReason(row.source_kind),
      tier: row.tier,
      level: levelFor(row.field_key, row.tier === 1 ? 'L0' : row.tier === 3 ? 'L3' : 'L2'),
    })
    const stored = facts[row.field_key]
    if (stored && isHouseholdFactCategory(row.category)) stored.category = row.category
  }

  return {
    identity: inputs.identity,
    postcode: inputs.postcode?.trim() || null,
    facts,
    accounts,
    bankSource: bank ? bank.analysis.source : 'none',
    answers,
    country: cleanToken(profile.country)?.toUpperCase() ?? null,
  }
}

const STREAMING = /netflix|disney|prime video|amazon prime|now tv|apple tv|paramount|spotify|youtube premium|britbox/i
const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }

function defaultReason(kind: StoredFactInput['source_kind']): string {
  switch (kind) {
    case 'public':
      return 'From public data.'
    case 'bill':
      return 'From a bill.'
    case 'bank':
      return 'From your bank payments.'
    case 'sample':
      return 'Sample data.'
    case 'derived':
      return 'Worked out from other facts.'
    default:
      return 'From what you told us.'
  }
}
