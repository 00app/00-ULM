/**
 * Household data service — the one place cards, agents and Zai load a household from (Z3).
 *
 *   const h = await getHousehold({ kind: 'user', userId })
 *   getCategoryFacts(h, 'tech'); getContracts(h); getGaps(h, 'utilities') …   (lib/household/queries)
 *
 * Builds on lib/household/data.ts for bills and contracts rather than adding a second accounts
 * service. Like data.ts it never throws into a route: each source that fails to load is logged and
 * left out, so the household is simply less known, never wrong.
 *
 * `household_facts` comes from db/migrations/20261025_intelligence_layer.sql, which is NOT applied
 * yet. Until it is, the table check returns false and stored facts are skipped.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { getDbPool } from '@/lib/db'
import { hydratePropertyIntelligence } from '@/lib/intelligence/freeTierHydration'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import { buildHousehold, type Household, type HouseholdInputs } from '@/lib/household/buildHousehold'
import { listHouseholdAccounts } from '@/lib/household/data'
import type { AccountInput, HouseholdIdentity, StoredFactInput } from '@/lib/household/records'
import { generateSyntheticHouseholds, isSyntheticHouseholdsEnabled } from '@/lib/household/synthetic'

function logFailure(op: string, err: unknown) {
  console.error(`[household-service] ${op} failed:`, err instanceof Error ? err.message : err)
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const toIso = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(v).toISOString()
  return null
}

// ── Public data cache ─────────────────────────────────────────────────────────────────────────
// The intelligence clients have no shared cache (Z2 audit, finding 8). Postcode-level public data
// changes slowly, so one lookup per postcode per day is plenty, and concurrent callers share one
// in-flight request instead of each hitting EPC, flood and PVGIS.

const PUBLIC_TTL_MS = 24 * 60 * 60 * 1000
const PUBLIC_MAX_ENTRIES = 500
const publicCache = new Map<string, { at: number; value: Promise<PropertyIntelligence | null> }>()

export function getPropertyIntelligenceCached(
  postcode: string,
  houseNumber?: string | null,
  now: number = Date.now()
): Promise<PropertyIntelligence | null> {
  const key = `${postcode.replace(/\s+/g, '').toUpperCase()}|${(houseNumber ?? '').trim().toUpperCase()}`
  const hit = publicCache.get(key)
  if (hit && now - hit.at < PUBLIC_TTL_MS) return hit.value
  const value = hydratePropertyIntelligence(postcode, { houseNumber: houseNumber ?? null }).catch((err) => {
    logFailure('property intelligence', err)
    publicCache.delete(key)
    return null
  })
  if (publicCache.size >= PUBLIC_MAX_ENTRIES) {
    const oldest = publicCache.keys().next().value
    if (oldest !== undefined) publicCache.delete(oldest)
  }
  publicCache.set(key, { at: now, value })
  return value
}

/** Test hook. */
export function clearHouseholdPublicCache(): void {
  publicCache.clear()
}

// ── Stored facts (household_facts, migration pending) ────────────────────────────────────────

let factsTableKnown: boolean | null = null

async function householdFactsTableExists(): Promise<boolean> {
  if (factsTableKnown !== null) return factsTableKnown
  try {
    const res = await getDbPool().query(`SELECT to_regclass('public.household_facts') IS NOT NULL AS ok`)
    factsTableKnown = Boolean(res.rows[0]?.ok)
  } catch (err) {
    logFailure('household_facts check', err)
    return false
  }
  return factsTableKnown
}

async function loadStoredFacts(owner: { userId?: string; guestSessionId?: string }): Promise<StoredFactInput[]> {
  if (!(await householdFactsTableExists())) return []
  try {
    const res = owner.userId
      ? await getDbPool().query(
          `SELECT category, field_key, value_jsonb, source_kind, source_name, source_url, as_of,
                  confidence, confidence_reason, tier
           FROM household_facts WHERE user_id = $1::uuid`,
          [owner.userId]
        )
      : await getDbPool().query(
          `SELECT category, field_key, value_jsonb, source_kind, source_name, source_url, as_of,
                  confidence, confidence_reason, tier
           FROM household_facts WHERE guest_session_id = $1 AND user_id IS NULL`,
          [owner.guestSessionId]
        )
    return res.rows.flatMap((r) => {
      const v = asRecord(r.value_jsonb)
      const asOf = toIso(r.as_of)
      if (!v || !('value' in v) || !asOf) return []
      return [
        {
          category: String(r.category),
          field_key: String(r.field_key),
          value: v.value as StoredFactInput['value'],
          unit: typeof v.unit === 'string' ? v.unit : null,
          source_kind: r.source_kind,
          source_name: String(r.source_name),
          source_url: r.source_url ?? null,
          as_of: asOf,
          confidence: r.confidence,
          confidence_reason: r.confidence_reason ?? null,
          tier: Number(r.tier) as StoredFactInput['tier'],
        },
      ]
    })
  } catch (err) {
    logFailure('load stored facts', err)
    return []
  }
}

// ── Inputs per identity ───────────────────────────────────────────────────────────────────────

export type GetHouseholdOptions = {
  /** Loop answers live in the browser today (loopMemory.ts); pass them through until Z7 stores them. */
  loopAnswers?: Record<string, string> | null
  /** Look up public data for a postcode with nothing stored. Cached for a day. Default true. */
  hydratePublic?: boolean
  now?: Date
}

async function userInputs(userId: string, opts: GetHouseholdOptions): Promise<HouseholdInputs> {
  const pool = getDbPool()
  let user: Record<string, unknown> | null = null
  let journey: { answers: Record<string, Record<string, unknown>> | null; asOf: string | null } = { answers: null, asOf: null }
  try {
    const res = await pool.query(
      `SELECT postcode, household, transport_baseline, age_group, employment_status, user_genome, created_at
       FROM users WHERE id = $1::uuid`,
      [userId]
    )
    user = res.rows[0] ?? null
  } catch (err) {
    logFailure('load user', err)
  }
  try {
    const res = await pool.query(
      `SELECT journey_answers_jsonb, updated_at FROM user_profiles WHERE user_id = $1::uuid`,
      [userId]
    )
    const row = res.rows[0]
    if (row) journey = { answers: asRecord(row.journey_answers_jsonb) as typeof journey.answers, asOf: toIso(row.updated_at) }
  } catch (err) {
    logFailure('load journey answers', err)
  }

  const genome = asRecord(user?.user_genome) ?? {}
  const postcode = typeof user?.postcode === 'string' ? user.postcode : null
  let property = (asRecord(genome.property_intelligence) as PropertyIntelligence | null) ?? null
  if (!property && postcode && opts.hydratePublic !== false) {
    property = await getPropertyIntelligenceCached(postcode, typeof genome.house_number === 'string' ? genome.house_number : null)
  }

  const [accounts, storedFacts] = await Promise.all([listHouseholdAccounts(userId), loadStoredFacts({ userId })])

  return {
    identity: { kind: 'user', userId },
    postcode,
    profile: {
      ...genome,
      household: user?.household,
      transport_baseline: user?.transport_baseline,
      age_group: user?.age_group,
      employment_status: user?.employment_status ?? genome.employment_status,
    },
    // users has no updated_at; created_at is the honest floor for when the answers were given.
    profileAsOf: toIso(user?.created_at),
    journeyAnswers: journey.answers,
    journeyAnswersAsOf: journey.asOf,
    loopAnswers: opts.loopAnswers ?? null,
    loopAnswersAsOf: opts.loopAnswers ? (opts.now ?? new Date()).toISOString() : null,
    property,
    accounts: accounts as AccountInput[],
    // Bank data lives client-side (sample provider) or is a stub (live); nothing to load server-side yet.
    bank: null,
    storedFacts,
  }
}

async function guestInputs(guestSessionId: string, opts: GetHouseholdOptions): Promise<HouseholdInputs> {
  let row: Record<string, unknown> | null = null
  try {
    const res = await getDbPool().query(
      `SELECT profile, journey_answers, updated_at FROM guest_sessions WHERE session_id = $1`,
      [guestSessionId]
    )
    row = res.rows[0] ?? null
  } catch (err) {
    logFailure('load guest session', err)
  }
  const profile = asRecord(row?.profile)
  const postcode = typeof profile?.postcode === 'string' && profile.postcode.trim() ? profile.postcode : null
  const asOf = toIso(row?.updated_at)
  const property = postcode && opts.hydratePublic !== false ? await getPropertyIntelligenceCached(postcode) : null
  return {
    identity: { kind: 'guest', guestSessionId },
    postcode,
    profile,
    profileAsOf: asOf,
    journeyAnswers: asRecord(row?.journey_answers) as HouseholdInputs['journeyAnswers'],
    journeyAnswersAsOf: asOf,
    loopAnswers: opts.loopAnswers ?? null,
    loopAnswersAsOf: opts.loopAnswers ? (opts.now ?? new Date()).toISOString() : null,
    property,
    accounts: [], // bills and contracts are signed-in only (see the household_accounts migration)
    bank: null,
    storedFacts: await loadStoredFacts({ guestSessionId }),
  }
}

let syntheticCache: Map<string, HouseholdInputs> | null = null

function syntheticInputs(id: string): HouseholdInputs | null {
  if (!isSyntheticHouseholdsEnabled()) return null
  if (!syntheticCache) syntheticCache = new Map(generateSyntheticHouseholds().map((s) => [s.id, s.inputs]))
  return syntheticCache.get(id) ?? null
}

export async function loadHouseholdInputs(
  identity: HouseholdIdentity,
  opts: GetHouseholdOptions = {}
): Promise<HouseholdInputs | null> {
  if (identity.kind === 'user') return identity.userId.trim() ? userInputs(identity.userId.trim(), opts) : null
  if (identity.kind === 'guest') return identity.guestSessionId.trim() ? guestInputs(identity.guestSessionId.trim(), opts) : null
  return syntheticInputs(identity.syntheticId)
}

/** The household for an identity, or null if there is no such identity (or synthetic is off). */
export async function getHousehold(
  identity: HouseholdIdentity,
  opts: GetHouseholdOptions = {}
): Promise<Household | null> {
  const inputs = await loadHouseholdInputs(identity, opts)
  return inputs ? buildHousehold(inputs, opts.now) : null
}

// ── Reference facts (data/facts.json, when present) ──────────────────────────────────────────

export type ReferenceFact = {
  id: string
  label: string
  value: number | string
  unit: string | null
  sourceName: string
  sourceUrl: string
  asOf: string
  refreshBy: string | null
}

/**
 * Published figures (price cap and so on) from data/facts.json, which front-door Prompt 3
 * creates. Entries without a source URL or as-of date are dropped. Missing file → [].
 */
export async function getReferenceFacts(file = path.join(process.cwd(), 'data', 'facts.json')): Promise<ReferenceFact[]> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    const list = Array.isArray(parsed) ? parsed : Array.isArray(asRecord(parsed)?.facts) ? (asRecord(parsed)!.facts as unknown[]) : []
    return list.flatMap((item) => {
      const f = asRecord(item)
      if (!f || typeof f.id !== 'string' || typeof f.sourceUrl !== 'string' || typeof f.asOf !== 'string') return []
      if (typeof f.value !== 'number' && typeof f.value !== 'string') return []
      return [
        {
          id: f.id,
          label: typeof f.label === 'string' ? f.label : f.id,
          value: f.value,
          unit: typeof f.unit === 'string' ? f.unit : null,
          sourceName: typeof f.sourceName === 'string' ? f.sourceName : f.sourceUrl,
          sourceUrl: f.sourceUrl,
          asOf: f.asOf,
          refreshBy: typeof f.refreshBy === 'string' ? f.refreshBy : null,
        },
      ]
    })
  } catch (err) {
    logFailure('parse data/facts.json', err)
    return []
  }
}
