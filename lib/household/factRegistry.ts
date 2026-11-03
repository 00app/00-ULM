/**
 * Household fact registry — the facts that matter per category, from docs/INTELLIGENCE-LOGIC.md §9.
 *
 * This is the "facts" half of each category spec only. Metrics, rules and options are Z6
 * (lib/intelligence/categories/<id>.ts), which should import `CATEGORY_FACTS` rather than
 * re-listing keys. Weights (1 to 5) say how much a fact moves money or eligibility and drive the
 * knowledge line ("We know 4 of 7 things that matter here") and which gap to ask about first.
 *
 * `questionId` names a LOOP_QUESTION_BANK id or a NEW card question from §11 (not built yet —
 * Z7 adds them). `onboardingKey` is a lib/journeys.ts question id or a core profile field.
 */

import type { HouseholdFactCategory, Level } from '@/lib/household/records'

export type FactFrom = 'onboarding' | 'loop' | 'card_question' | 'public' | 'account' | 'bank' | 'derived'

export type FactSpec = {
  key: string
  label: string
  level: Level
  weight: 1 | 2 | 3 | 4 | 5
  from: FactFrom[]
  questionId?: string
  onboardingKey?: string
  accountCategory?: string
}

type Row = [key: string, label: string, level: Level, weight: FactSpec['weight'], from: FactFrom[], extra?: Partial<FactSpec>]

const rows = (list: Row[]): FactSpec[] =>
  list.map(([key, label, level, weight, from, extra]) => ({ key, label, level, weight, from, ...extra }))

export const CATEGORY_FACTS: Record<HouseholdFactCategory, FactSpec[]> = {
  tech: rows([
    ['smart_meter', 'Smart meter', 'L1', 1, ['onboarding'], { onboardingKey: 'smart_meter' }],
    ['smart_thermostat', 'Smart thermostat', 'L1', 1, ['onboarding'], { onboardingKey: 'smart_thermostat' }],
    ['smart_home', 'Smart home devices', 'L1', 1, ['onboarding'], { onboardingKey: 'smart_home' }],
    ['broadband_provider', 'Broadband provider', 'L3', 3, ['account', 'card_question'], { accountCategory: 'broadband', questionId: 'tech_broadband_provider' }],
    ['broadband_monthly_price', 'Broadband price a month', 'L3', 4, ['account'], { accountCategory: 'broadband' }],
    ['broadband_contract_end', 'Broadband contract end date', 'L3', 5, ['account', 'card_question'], { accountCategory: 'broadband', questionId: 'tech_broadband_end' }],
    ['mobile_monthly_price', 'Mobile price a month', 'L3', 3, ['account'], { accountCategory: 'mobile' }],
    ['mobile_contract_end', 'Mobile contract end date', 'L3', 4, ['account'], { accountCategory: 'mobile' }],
    ['mobile_handset_paid_off', 'Phone paid off', 'L3', 4, ['card_question'], { questionId: 'tech_mobile_handset' }],
    ['streaming_services', 'Streaming services', 'L3', 3, ['account', 'bank'], { accountCategory: 'streaming' }],
    ['receives_means_tested_benefit', 'Gets a means-tested benefit', 'L2', 4, ['card_question'], { questionId: 'money_benefits_yes_no' }],
  ]),
  utilities: rows([
    ['supplier', 'Energy supplier', 'L1', 3, ['onboarding'], { onboardingKey: 'energySupplier' }],
    ['tariff_type', 'Tariff type', 'L1', 4, ['onboarding'], { onboardingKey: 'tariff_type' }],
    ['monthly_energy_band', 'Monthly energy spend band', 'L1', 3, ['onboarding'], { onboardingKey: 'monthly_energy_band' }],
    ['fix_end_date', 'Fixed tariff end date', 'L2', 5, ['account', 'card_question'], { accountCategory: 'energy_fix', questionId: 'utilities_fix_end' }],
    ['energy_direct_debit', 'Energy direct debit a month', 'L3', 3, ['account'], { accountCategory: 'electricity' }],
    ['account_credit_months', 'Months of credit on the account', 'L2', 2, ['card_question'], { questionId: 'utilities_in_credit' }],
    ['power_type', 'How the home is heated', 'L1', 3, ['onboarding'], { onboardingKey: 'powerType' }],
    ['has_ev', 'Electric or hybrid car', 'L1', 3, ['onboarding'], { onboardingKey: 'ev_hybrid' }],
    ['has_heat_pump', 'Heat pump', 'L1', 3, ['onboarding'], { onboardingKey: 'powerType' }],
    ['smart_meter', 'Smart meter', 'L1', 2, ['onboarding'], { onboardingKey: 'smart_meter' }],
    ['financial_pressure', 'How money feels', 'L1', 4, ['onboarding'], { onboardingKey: 'financialPressure' }],
  ]),
  money: rows([
    ['financial_pressure', 'How money feels', 'L1', 5, ['onboarding'], { onboardingKey: 'financialPressure' }],
    ['employment_status', 'Work', 'L1', 3, ['onboarding'], { onboardingKey: 'employmentStatus' }],
    ['age_group', 'Age group', 'L1', 3, ['onboarding'], { onboardingKey: 'age' }],
    ['household', 'Who you live with', 'L1', 3, ['onboarding'], { onboardingKey: 'livingSituation' }],
    ['children', 'Children', 'L1', 3, ['onboarding'], { onboardingKey: 'children' }],
    ['council_tax_band', 'Council tax band', 'L0', 3, ['public']],
    ['single_occupier', 'Lives alone', 'L1', 3, ['derived'], { onboardingKey: 'livingSituation' }],
    ['savings_rate', 'Savings interest rate', 'L2', 3, ['card_question'], { questionId: 'money_savings_rate' }],
    ['subscriptions', 'Subscriptions', 'L4', 3, ['bank']],
    ['benefits_check_done', 'Benefits check done', 'L2', 4, ['card_question'], { questionId: 'money_benefits_checked' }],
    ['monthly_outgoings', 'Outgoings a month', 'L4', 4, ['bank']],
  ]),
  lifestyle: rows([
    ['memberships', 'Memberships', 'L2', 4, ['account', 'loop'], { accountCategory: 'membership', questionId: 'lifestyle_memberships' }],
    ['membership_uses_per_month', 'Visits a month', 'L2', 5, ['account', 'loop'], { accountCategory: 'membership', questionId: 'lifestyle_visits' }],
    ['eating_out_per_week', 'Eating out or ordering in a week', 'L2', 3, ['loop'], { questionId: 'lifestyle_eat_out' }],
    ['takeaway_app_subscription', 'Takeaway app subscription', 'L1', 2, ['onboarding', 'bank'], { onboardingKey: 'takeaway_subscription' }],
    ['pet_owner', 'Pets at home', 'L1', 3, ['onboarding'], { onboardingKey: 'pet_owner' }],
    ['memberships_checked', 'Last checked membership costs', 'L1', 1, ['onboarding'], { onboardingKey: 'memberships_checked' }],
    ['pet_insurance_renewal', 'Pet insurance renewal date', 'L3', 3, ['account'], { accountCategory: 'pet_insurance' }],
    ['leisure_concession_eligible', 'Leisure concessions may apply', 'L1', 2, ['derived']],
  ]),
  home: rows([
    ['tenure', 'Own or rent', 'L1', 5, ['onboarding'], { onboardingKey: 'homeOwnership' }],
    ['property_type', 'Property type', 'L1', 3, ['onboarding'], { onboardingKey: 'property_type' }],
    ['insulation_level', 'Insulation', 'L1', 3, ['onboarding'], { onboardingKey: 'insulation_level' }],
    ['glazing_type', 'Glazing', 'L1', 3, ['onboarding'], { onboardingKey: 'glazing_type' }],
    ['epc_band', 'EPC band', 'L0', 4, ['public']],
    ['epc_potential', 'EPC potential band', 'L0', 4, ['public']],
    ['walls', 'Walls', 'L0', 4, ['public']],
    ['loft', 'Roof and loft', 'L0', 4, ['public']],
    ['main_heating', 'Main heating fuel', 'L0', 4, ['public']],
    ['boiler_age_band', 'Boiler age', 'L2', 3, ['card_question'], { questionId: 'home_boiler_age' }],
    ['loft_depth', 'Loft insulation', 'L2', 3, ['loop', 'card_question'], { questionId: 'home_loft_insulate' }],
    ['flood_risk', 'Flood risk', 'L0', 2, ['public']],
    ['home_insurance_renewal', 'Home insurance renewal date', 'L3', 3, ['account'], { accountCategory: 'home_insurance' }],
    ['heat_pump_interest', 'Heat pump interest', 'L2', 2, ['loop'], { questionId: 'home_heat_pump' }],
  ]),
  water: rows([
    ['supplier_water', 'Water supplier', 'L0', 2, ['public']],
    ['metered', 'Water meter', 'L2', 5, ['loop', 'card_question'], { questionId: 'water_meter_save' }],
    ['occupants', 'People at home', 'L1', 4, ['onboarding', 'card_question']],
    ['bedrooms', 'Bedrooms', 'L0', 3, ['public']],
    ['water_bill_year', 'Water bill a year', 'L3', 4, ['account'], { accountCategory: 'water' }],
    ['wash_preference', 'Washing', 'L1', 1, ['onboarding'], { onboardingKey: 'wash_preference' }],
    ['garden_butt', 'Water butt', 'L1', 1, ['onboarding'], { onboardingKey: 'garden_butt' }],
    ['financial_pressure', 'How money feels', 'L1', 4, ['onboarding'], { onboardingKey: 'financialPressure' }],
  ]),
  travel: rows([
    ['commute_distance', 'Commute distance', 'L1', 3, ['onboarding'], { onboardingKey: 'commute_distance' }],
    ['ev_hybrid', 'Electric or hybrid car', 'L1', 3, ['onboarding'], { onboardingKey: 'ev_hybrid' }],
    ['public_transport', 'Public transport use', 'L1', 3, ['onboarding'], { onboardingKey: 'public_transport' }],
    ['transport', 'Main transport', 'L1', 3, ['onboarding'], { onboardingKey: 'transport' }],
    ['weekly_miles', 'Miles a week', 'L2', 4, ['card_question'], { questionId: 'travel_weekly_miles' }],
    ['car_insurance_renewal', 'Car insurance renewal date', 'L3', 4, ['account'], { accountCategory: 'car_insurance' }],
    ['mot_due', 'MOT due date', 'L3', 4, ['account']],
    ['vehicle_tax_due', 'Vehicle tax due date', 'L3', 4, ['account'], { accountCategory: 'vehicle_tax' }],
    ['rail_trips_per_month', 'Train trips a month', 'L2', 3, ['card_question'], { questionId: 'travel_rail_trips' }],
    ['age_group', 'Age group', 'L1', 2, ['onboarding'], { onboardingKey: 'age' }],
    ['employment_status', 'Work', 'L1', 2, ['onboarding'], { onboardingKey: 'employmentStatus' }],
  ]),
  holidays: rows([
    ['annual_flights', 'Flights a year', 'L1', 3, ['onboarding'], { onboardingKey: 'annual_flights' }],
    ['flight_duration', 'Flight length', 'L1', 3, ['onboarding'], { onboardingKey: 'flight_duration' }],
    ['carbon_offsets', 'Carbon offsets', 'L1', 3, ['onboarding'], { onboardingKey: 'carbon_offsets' }],
    ['trips_per_year', 'Trips a year', 'L2', 3, ['loop'], { questionId: 'holidays_local_vs_longhaul' }],
    ['rail_open', 'Open to rail', 'L2', 2, ['loop'], { questionId: 'holidays_train_not_plane' }],
    ['travel_insurance', 'Travel insurance', 'L3', 3, ['account', 'card_question'], { accountCategory: 'travel_insurance', questionId: 'holidays_insurance_type' }],
  ]),
  food: rows([
    ['diet_profile', 'Diet', 'L1', 2, ['onboarding'], { onboardingKey: 'diet_profile' }],
    ['organic_shopping', 'Organic shopping', 'L1', 2, ['onboarding'], { onboardingKey: 'organic_shopping' }],
    ['own_produce', 'Grow your own', 'L1', 2, ['onboarding'], { onboardingKey: 'own_produce' }],
    ['weekly_shop_band', 'Weekly shop', 'L2', 4, ['card_question'], { questionId: 'food_weekly_shop' }],
    ['main_supermarket', 'Main supermarket', 'L2', 3, ['card_question'], { questionId: 'food_supermarket' }],
    ['food_waste_level', 'Food waste', 'L2', 3, ['loop'], { questionId: 'food_waste_cut' }],
    ['children', 'Children', 'L1', 4, ['onboarding'], { onboardingKey: 'children' }],
    ['financial_pressure', 'How money feels', 'L1', 4, ['onboarding'], { onboardingKey: 'financialPressure' }],
  ]),
  shopping: rows([
    ['retail_channel', 'Where you shop', 'L1', 2, ['onboarding'], { onboardingKey: 'retail_channel' }],
    ['repair_mindset', 'Repair or replace', 'L1', 2, ['onboarding'], { onboardingKey: 'repair_mindset' }],
    ['online_deliveries', 'Online deliveries', 'L1', 2, ['onboarding'], { onboardingKey: 'online_deliveries' }],
    ['planned_big_purchase', 'Planned big purchase', 'L2', 4, ['card_question'], { questionId: 'shopping_planned_purchase' }],
    ['repair_first', 'Repair first', 'L2', 2, ['loop'], { questionId: 'shopping_repair_first' }],
    ['student', 'Student', 'L1', 2, ['derived'], { onboardingKey: 'employmentStatus' }],
  ]),
  solar: rows([
    ['tenure', 'Own or rent', 'L1', 5, ['onboarding'], { onboardingKey: 'homeOwnership' }],
    ['roof_orientation', 'Roof direction', 'L1', 4, ['onboarding'], { onboardingKey: 'roof_orientation' }],
    ['roof_shading', 'Roof shading', 'L1', 4, ['onboarding'], { onboardingKey: 'roof_shading' }],
    ['daytime_occupancy', 'Home in the day', 'L1', 4, ['onboarding'], { onboardingKey: 'daytime_occupancy' }],
    ['pvgis_kwh_year', 'Likely solar output a year', 'L0', 4, ['public']],
    ['irradiance', 'Sunlight a year', 'L0', 2, ['public']],
    ['has_panels', 'Solar panels', 'L2', 5, ['loop'], { questionId: 'solar_roof_fit' }],
    ['has_battery', 'Home battery', 'L2', 3, ['card_question'], { questionId: 'solar_battery' }],
    ['export_tariff', 'Export tariff', 'L2', 3, ['card_question'], { questionId: 'solar_export_tariff' }],
  ]),
  waste: rows([
    ['food_waste_collection', 'Food waste collection', 'L1', 2, ['onboarding'], { onboardingKey: 'food_waste_collection' }],
    ['composting', 'Composting', 'L1', 2, ['onboarding'], { onboardingKey: 'composting' }],
    ['soft_plastics', 'Soft plastics', 'L1', 2, ['onboarding'], { onboardingKey: 'soft_plastics' }],
    ['council_collections', 'Council collections', 'L0', 3, ['public']],
    ['garden_waste_subscription', 'Garden waste subscription', 'L2', 3, ['card_question'], { questionId: 'waste_garden_sub' }],
    ['compost_open', 'Open to composting', 'L2', 2, ['loop'], { questionId: 'waste_compost' }],
  ]),
  // Carbon has no facts of its own (§9.13): it rolls up the other categories.
  carbon: [],
}

export const HOUSEHOLD_FACT_CATEGORIES = Object.keys(CATEGORY_FACTS) as HouseholdFactCategory[]

export function isHouseholdFactCategory(value: unknown): value is HouseholdFactCategory {
  return typeof value === 'string' && (HOUSEHOLD_FACT_CATEGORIES as string[]).includes(value)
}

/** Every distinct fact key across categories (a key like financial_pressure sits in several). */
export const ALL_FACT_KEYS: readonly string[] = [
  ...new Set(HOUSEHOLD_FACT_CATEGORIES.flatMap((c) => CATEGORY_FACTS[c].map((f) => f.key))),
]

/** First category that lists a key; used to file a fact that arrives without a category. */
export function homeCategoryForFact(key: string): HouseholdFactCategory | null {
  return HOUSEHOLD_FACT_CATEGORIES.find((c) => CATEGORY_FACTS[c].some((f) => f.key === key)) ?? null
}
