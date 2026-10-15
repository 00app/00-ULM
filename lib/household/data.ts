/**
 * Household living persistence — `household_accounts` (bills and contracts) and
 * `household_moves` (house moves + change-of-address checklist). Signed-in users only: every
 * call is scoped by users.id and there is no guest-session path (see the migration header).
 * Never throws into a route — failures are logged and come back as empty / null / false.
 */
import { getDbPool } from '@/lib/db'
import {
  HOUSEHOLD_CATEGORIES,
  HOUSEHOLD_GROUP_ORDER,
  householdGroupFor,
  isHouseholdCategory,
  isHouseholdGroup,
  type HouseholdCategory,
  type HouseholdGroup,
} from '@/lib/household/categories'

export type HouseholdAccountSource = 'manual' | 'bank'
export type HouseholdAccountStatus = 'active' | 'ended'

export type HouseholdAccount = {
  id: string
  user_id: string
  category: HouseholdCategory
  provider_name: string | null
  nickname: string | null
  monthly_amount_pence: number | null
  renewal_date: string | null
  contract_end_date: string | null
  postcode: string | null
  source: HouseholdAccountSource
  status: HouseholdAccountStatus
  created_at: string
  updated_at: string
}

export type HouseholdAccountInput = {
  /** Present → update that account (if it belongs to the user); absent → insert. */
  id?: string
  category: HouseholdCategory
  provider_name?: string | null
  nickname?: string | null
  monthly_amount_pence?: number | null
  renewal_date?: string | null
  contract_end_date?: string | null
  postcode?: string | null
  source?: HouseholdAccountSource
}

export type HouseholdMove = {
  id: string
  user_id: string
  from_postcode: string | null
  to_postcode: string
  move_date: string | null
  checklist_jsonb: Record<string, unknown>
  created_at: string
  updated_at: string
}

const ACCOUNT_COLUMNS = `id, user_id, category, provider_name, nickname, monthly_amount_pence,
  to_char(renewal_date, 'YYYY-MM-DD') AS renewal_date,
  to_char(contract_end_date, 'YYYY-MM-DD') AS contract_end_date,
  postcode, source, status, created_at, updated_at`

const MOVE_COLUMNS = `id, user_id, from_postcode, to_postcode,
  to_char(move_date, 'YYYY-MM-DD') AS move_date,
  checklist_jsonb, created_at, updated_at`

function logFailure(op: string, err: unknown) {
  console.error(`[household] ${op} failed:`, err instanceof Error ? err.message : err)
}

/** Active accounts for a user, optionally narrowed to one category. */
export async function listHouseholdAccounts(
  userId: string | null | undefined,
  category?: HouseholdCategory
): Promise<HouseholdAccount[]> {
  const uid = userId?.trim()
  if (!uid) return []
  if (category !== undefined && !isHouseholdCategory(category)) return []
  try {
    const pool = getDbPool()
    const res = category
      ? await pool.query(
          `SELECT ${ACCOUNT_COLUMNS} FROM household_accounts
           WHERE user_id = $1::uuid AND category = $2 AND status = 'active'
           ORDER BY created_at ASC`,
          [uid, category]
        )
      : await pool.query(
          `SELECT ${ACCOUNT_COLUMNS} FROM household_accounts
           WHERE user_id = $1::uuid AND status = 'active'
           ORDER BY category ASC, created_at ASC`,
          [uid]
        )
    return res.rows as HouseholdAccount[]
  } catch (err) {
    logFailure('list accounts', err)
    return []
  }
}

/** Active account count per Settings → Living group (all zero when signed out or on failure). */
export async function countHouseholdAccountsByGroup(
  userId: string | null | undefined
): Promise<Record<HouseholdGroup, number>> {
  const counts = Object.fromEntries(HOUSEHOLD_GROUP_ORDER.map((g) => [g, 0])) as Record<HouseholdGroup, number>
  const uid = userId?.trim()
  if (!uid) return counts
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `SELECT category, COUNT(*)::int AS n FROM household_accounts
       WHERE user_id = $1::uuid AND status = 'active'
       GROUP BY category`,
      [uid]
    )
    for (const row of res.rows as { category: string; n: number }[]) {
      if (isHouseholdCategory(row.category)) counts[householdGroupFor(row.category)] += row.n
    }
    return counts
  } catch (err) {
    logFailure('count accounts', err)
    return counts
  }
}

/** Active accounts for a whole Settings → Living group (all of that group's categories). */
export async function listHouseholdAccountsByGroup(
  userId: string | null | undefined,
  group: HouseholdGroup
): Promise<HouseholdAccount[]> {
  const uid = userId?.trim()
  if (!uid || !isHouseholdGroup(group)) return []
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `SELECT ${ACCOUNT_COLUMNS} FROM household_accounts
       WHERE user_id = $1::uuid AND category = ANY($2::text[]) AND status = 'active'
       ORDER BY created_at ASC`,
      [uid, HOUSEHOLD_CATEGORIES[group]]
    )
    return res.rows as HouseholdAccount[]
  } catch (err) {
    logFailure('list accounts by group', err)
    return []
  }
}

/** Insert a new account, or update an existing one the user owns. Returns the saved row. */
export async function upsertHouseholdAccount(
  userId: string | null | undefined,
  input: HouseholdAccountInput
): Promise<HouseholdAccount | null> {
  const uid = userId?.trim()
  if (!uid || !isHouseholdCategory(input.category)) return null
  const params: unknown[] = [
    uid,
    input.category,
    input.provider_name?.trim() || null,
    input.nickname?.trim() || null,
    input.monthly_amount_pence ?? null,
    input.renewal_date || null,
    input.contract_end_date || null,
    input.postcode?.trim() || null,
    input.source ?? 'manual',
  ]
  try {
    const pool = getDbPool()
    const id = input.id?.trim()
    const res = id
      ? await pool.query(
          `UPDATE household_accounts SET
             category = $2, provider_name = $3, nickname = $4, monthly_amount_pence = $5,
             renewal_date = $6::date, contract_end_date = $7::date, postcode = $8, source = $9,
             updated_at = NOW()
           WHERE id = $10::uuid AND user_id = $1::uuid
           RETURNING ${ACCOUNT_COLUMNS}`,
          [...params, id]
        )
      : await pool.query(
          `INSERT INTO household_accounts
             (user_id, category, provider_name, nickname, monthly_amount_pence,
              renewal_date, contract_end_date, postcode, source)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::date, $8, $9)
           RETURNING ${ACCOUNT_COLUMNS}`,
          params
        )
    return (res.rows[0] as HouseholdAccount | undefined) ?? null
  } catch (err) {
    logFailure('upsert account', err)
    return null
  }
}

/** Soft delete — marks the account ended so it drops out of lists but keeps its history. */
export async function endHouseholdAccount(
  userId: string | null | undefined,
  accountId: string | null | undefined
): Promise<boolean> {
  const uid = userId?.trim()
  const id = accountId?.trim()
  if (!uid || !id) return false
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `UPDATE household_accounts SET status = 'ended', updated_at = NOW()
       WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'active'`,
      [id, uid]
    )
    return (res.rowCount ?? 0) > 0
  } catch (err) {
    logFailure('end account', err)
    return false
  }
}

export async function createHouseholdMove(
  userId: string | null | undefined,
  input: { to_postcode: string; from_postcode?: string | null; move_date?: string | null }
): Promise<HouseholdMove | null> {
  const uid = userId?.trim()
  const to = input.to_postcode?.trim()
  if (!uid || !to) return null
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `INSERT INTO household_moves (user_id, from_postcode, to_postcode, move_date)
       VALUES ($1::uuid, $2, $3, $4::date)
       RETURNING ${MOVE_COLUMNS}`,
      [uid, input.from_postcode?.trim() || null, to, input.move_date || null]
    )
    return (res.rows[0] as HouseholdMove | undefined) ?? null
  } catch (err) {
    logFailure('create move', err)
    return null
  }
}

/** Replace a move's checklist (the caller owns merging). Returns the updated row. */
export async function updateHouseholdMoveChecklist(
  userId: string | null | undefined,
  moveId: string | null | undefined,
  checklist: Record<string, unknown>
): Promise<HouseholdMove | null> {
  const uid = userId?.trim()
  const id = moveId?.trim()
  if (!uid || !id) return null
  try {
    const pool = getDbPool()
    const res = await pool.query(
      `UPDATE household_moves SET checklist_jsonb = $3::jsonb, updated_at = NOW()
       WHERE id = $1::uuid AND user_id = $2::uuid
       RETURNING ${MOVE_COLUMNS}`,
      [id, uid, JSON.stringify(checklist ?? {})]
    )
    return (res.rows[0] as HouseholdMove | undefined) ?? null
  } catch (err) {
    logFailure('update move checklist', err)
    return null
  }
}
