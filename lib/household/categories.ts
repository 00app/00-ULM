/**
 * Household living taxonomy — the `household_accounts.category` values grouped for the
 * Settings → Living cards. Must stay in step with the CHECK constraint in
 * db/migrations/20261015_household_accounts.sql.
 *
 * Deliberately separate from `RecurringCategory` in lib/bank/analysis.ts (bank-matched
 * recurring payments: 'energy' | 'broadband' | 'mobile' | 'insurance' | …). The two will need
 * reconciling once bank-matched transactions and manually added accounts are shown together —
 * e.g. bank 'energy' vs electricity/gas here, bank 'insurance' vs home/car insurance.
 */

export type HouseholdCategory =
  | 'electricity'
  | 'gas'
  | 'water'
  | 'broadband'
  | 'mobile'
  | 'council_tax'
  | 'mortgage'
  | 'rent'
  | 'home_insurance'
  | 'car_insurance'
  | 'vehicle_tax'
  | 'subscription'
  | 'other'

export type HouseholdGroup = 'home' | 'utilities' | 'vehicle' | 'subscriptions'

export const HOUSEHOLD_GROUP_ORDER: readonly HouseholdGroup[] = ['home', 'utilities', 'vehicle', 'subscriptions']

export const HOUSEHOLD_CATEGORIES: Record<HouseholdGroup, readonly HouseholdCategory[]> = {
  home: ['mortgage', 'rent', 'council_tax', 'home_insurance'],
  utilities: ['electricity', 'gas', 'water', 'broadband'],
  vehicle: ['car_insurance', 'vehicle_tax'],
  subscriptions: ['mobile', 'subscription', 'other'],
}

export const HOUSEHOLD_GROUP_LABELS: Record<HouseholdGroup, string> = {
  home: 'Home',
  utilities: 'Utilities',
  vehicle: 'Vehicle',
  subscriptions: 'Phone and subscriptions',
}

export const HOUSEHOLD_CATEGORY_LABELS: Record<HouseholdCategory, string> = {
  electricity: 'Electricity',
  gas: 'Gas',
  water: 'Water',
  broadband: 'Broadband',
  mobile: 'Mobile phone',
  council_tax: 'Council tax',
  mortgage: 'Mortgage',
  rent: 'Rent',
  home_insurance: 'Home insurance',
  car_insurance: 'Car insurance',
  vehicle_tax: 'Vehicle tax',
  subscription: 'Subscription',
  other: 'Other',
}

export const ALL_HOUSEHOLD_CATEGORIES: readonly HouseholdCategory[] = HOUSEHOLD_GROUP_ORDER.flatMap(
  (g) => HOUSEHOLD_CATEGORIES[g]
)

export function isHouseholdCategory(value: unknown): value is HouseholdCategory {
  return typeof value === 'string' && (ALL_HOUSEHOLD_CATEGORIES as readonly string[]).includes(value)
}

export function isHouseholdGroup(value: unknown): value is HouseholdGroup {
  return typeof value === 'string' && (HOUSEHOLD_GROUP_ORDER as readonly string[]).includes(value)
}

export function householdGroupFor(category: HouseholdCategory): HouseholdGroup {
  return HOUSEHOLD_GROUP_ORDER.find((g) => HOUSEHOLD_CATEGORIES[g].includes(category)) ?? 'subscriptions'
}

/** One moving-house checklist entry's status, per household category. */
export type MoveChecklistStatus = 'pending' | 'transferred' | 'cancel' | 'set_up_new'

export const MOVE_CHECKLIST_STATUS_LABELS: Record<MoveChecklistStatus, string> = {
  pending: 'Not actioned yet',
  transferred: 'Transferred to new address',
  cancel: 'Cancelling, not moving',
  set_up_new: 'Setting up new at new address',
}

export const MOVE_CHECKLIST_STATUSES: readonly MoveChecklistStatus[] = [
  'pending',
  'transferred',
  'cancel',
  'set_up_new',
]

export function isMoveChecklistStatus(value: unknown): value is MoveChecklistStatus {
  return typeof value === 'string' && (MOVE_CHECKLIST_STATUSES as readonly string[]).includes(value)
}
