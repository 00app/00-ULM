# Zero Zero intelligence logic (PRD v4)

Version 1, 25 Oct 2026. The build spec for the Zone intelligence layer across all 13 categories.
Companion files: docs/HANDOFF-zone-intelligence.md (prompts Z3 to Z12), docs/AUDIT-Z2-zone-intelligence.md (current state), docs/BRAND-LANGUAGE.md (UI), db/migrations/20261025_intelligence_layer.sql (schema).
PRD v4: https://claude.ai/artifact/8eJ2WsMJJZQtCLFj6mCbcc

**How to use this file.** Each category section maps one-to-one to `lib/intelligence/categories/<id>.ts`. Names in `code` are real identifiers in this repo unless marked **NEW**. Anything marked NEW must be added with its own source and `verifiedOn` before it ships. This file never supplies a £ or kg figure: figures come from the action library, published facts or the household's own data, with a source.

---

## 1. Core rules

1. **Rules decide, AI explains.** Figures, eligibility, ranking and question choice are code. Gemini writes headline and why wording only (section 8).
2. **Mechanical truth.** Every figure has source, as-of and confidence. Unknown stays `null`. `resolveRecCard` still returns `null` for a card that cannot be supported.
3. **Unknown passes relevance, fails eligibility.** Keep the existing `gates` vs `requires` semantics in `lib/actions/actionTypes.ts`.
4. **Ask only what changes the answer** (section 4).
5. **Agents prepare, people approve.** Approval tiers 0 to 3.
6. **No sensitive data.** Never ask or infer health, ID, logins, account numbers, sexuality, religion, politics. Lifestyle and food never imply health.

---

## 2. Profile ladder

Knowledge builds in five levels. A card states which level its figure comes from (tier in the schema: L0 and L1 = tier 1; L2 = tier 2; L3 and L4 = tier 3 when from bills or bank, tier 2 when typed).

| Level | What we know | How we get it | Guest? |
| --- | --- | --- | --- |
| L0 Place | Postcode, nation, council, region, supplier region, grid, flood, deprivation, EPC when address matched | Postcode and property prefill, intelligence clients | Yes |
| L1 Profile | Onboarding answers: 3 per journey in `lib/journeys.ts`, plus core fields (tenure, financial pressure, household, children, employment, age, powerType, supplier, transport, wash) | Onboarding | Yes |
| L2 Detail | Loop and card questions that fill specific `field_key`s | Knowledge gathering on cards | Yes |
| L3 Accounts | Providers, prices, renewal and contract end dates, usage | `household_accounts`, typed or from bills | Signed in |
| L4 Transactions | Recurring payments, spend by category | `lib/bank` live provider with consent | Signed in |

**Category knowledge state** (shown as a small progress line on Solo Focus, "We know 4 of 7 things that matter here"):

```
knowledgeScore(category) = sum(weight of known facts) / sum(weight of all facts in the category spec)
state = unknown (< 0.2) | partial (0.2 to 0.7) | known (> 0.7)
```

Fact weights live in each category spec (`facts[].weight`, 1 to 5, by how much the fact moves money or eligibility).

---

## 3. Shared types

Add to `lib/intelligence/categories/types.ts` (**NEW**).

```ts
import type { JourneyId } from '@/lib/journeys'   // includes 'lifestyle' after Z5

export type Level = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'
export type Confidence = 'high' | 'medium' | 'low'

export type FactSpec = {
  key: string                 // household_facts.field_key, e.g. 'broadband_contract_end'
  label: string               // "Broadband contract end date"
  level: Level
  weight: 1 | 2 | 3 | 4 | 5
  from: Array<'onboarding' | 'loop' | 'card_question' | 'public' | 'account' | 'bank'>
  questionId?: string         // LOOP_QUESTION_BANK id or NEW card question id
  onboardingKey?: string      // lib/journeys.ts question id
  accountCategory?: string    // household_accounts.category
}

export type MetricSpec = {
  key: string
  label: string               // shown in the Solo Focus metric strip
  unit: 'gbp_month' | 'gbp_year' | 'kg_year' | 'count' | 'date' | 'band' | 'percent' | 'kwh_year'
  needs: string[]             // fact keys; metric is null unless all are known
  compute: string             // formula in words; implement as a pure function
  source: string              // where the inputs come from
}

export type RuleSpec = {
  id: string                  // '<category>.<finding>', e.g. 'tech.broadband_out_of_contract'
  when: string                // condition on facts; implement as a pure predicate
  finding: string             // template, facts in {braces}; plain English, no figures not in facts
  drivers: string[]           // fact keys shown in the Why panel
  actions: string[]           // action library ids (existing or NEW)
  options: OptionSpec[]       // 2 or 3
  deadlineFact?: string       // fact key holding a date that boosts rank as it approaches
  agent?: string              // zone agent id to switch on
}

export type OptionSpec = {
  key: string
  label: string               // "Switch provider", "Haggle with your provider", "Stay and set a reminder"
  actionId?: string
  effortMinutes: number
  approvalTier: 0 | 1 | 2 | 3
  tradeOff: string            // one line, honest
  prepares: 'link' | 'letter' | 'script' | 'reminder' | 'checklist' | 'none'
}

export type CategorySpec = {
  id: JourneyId
  facts: FactSpec[]
  metrics: MetricSpec[]       // 3 to 4
  rules: RuleSpec[]
  soloExtras: string[]        // category-specific Solo Focus blocks (section 6)
  context: string[]           // context signals that apply (section 7)
}
```

---

## 4. Scoring

### 4.1 Card rank (extends `scoreAction` in `lib/actions/selectActions.ts`; keep its hard filters and diversity)

```
valueMid     = midpoint of £ range a year (cap 1,500), else library valueGbp (cap 1,500), else 0
kgMid        = midpoint of kg range a year (cap 1,500), else valueKg
confW        = high 1.0 | medium 0.7 | low 0.4
effortW      = 1 / (1 + effortMinutes / 30)
deadlineW    = deadlineFact within 7 days 1.6 | 30 days 1.3 | 60 days 1.1 | else 1.0
seasonW      = action.window matches this month 1.15 | else 1.0
dismissW     = dismissed in last 30 days 0 | dismissed 31 to 90 days 0.6 | else 1.0
goalW        = from existing goal weighting (money, carbon, balanced) applied to £ vs kg

score = (valueMid / 10 + kgMid / 100 + existing scoreAction bonuses) * confW * effortW * deadlineW * seasonW * dismissW * goalW
```

Hero = highest score with confidence medium or high and a deadline or a £ range. If none, hero = highest score.

### 4.2 Question value (picks the next question)

```
For each unanswered, not-snoozed question q:
  gated   = cards whose rule.when or action.requires reads q's fact
  stake   = sum over gated of valueMid (or library valueGbp)
  uncert  = 1 - knowledgeScore(category of q)
  urgency = 1.3 if any gated card has a deadline within 60 days, else 1.0
  ease    = choice 1.0 | date 0.9 | number 0.8 | provider picker 0.8
  qValue  = stake * uncert * urgency * ease
```

Show the top `qValue` on the card it serves. Limits: 1 per card, 3 per session, skip snoozes 30 days, never ask an L0 fact.

### 4.3 Confidence

```
high   = all drivers known at L0, L3 or L4, and every source as-of within its refresh window
medium = any driver from L1 or L2 (told us), or a source older than its window
low    = any driver estimated from postcode averages or peer data, or a sample source
```

The reason line names the weakest driver: "Medium: your contract end date is from what you told us."

### 4.4 Saving kind

- `typical`: library figure, shown "Typically worth £N a year".
- `estimated`: computed from this household's facts with a stated method, shown "Likely £A to £B a year for you".
- `realised`: only from `task_evidence`, shown "Saved £N a year, confirmed {date}".
- `sample`: demo data, always badged.

---

## 5. Zone card (compact)

Label (category, status tag) · headline · key metric with source line · confidence dot · one context chip · Open.
The key metric is the rule's main figure if present, else the category's first non-null metric.

## 6. Solo Focus card (rich)

Render in this order, all in docs/BRAND-LANGUAGE.md style:

1. **Label and freshness:** category, status tag, "Updated {as_of}".
2. **Headline:** the finding.
3. **Metric strip:** the category's 3 to 4 metrics, count-up, source under each, `null` shown as "Not known yet" with a link to the question that fills it.
4. **Knowledge line:** "We know 4 of 7 things that matter here" with a thin progress bar.
5. **Why panel:** hairline accordion of drivers: label, value, source, date.
6. **Confidence:** level and reason.
7. **One question:** the top `qValue` question for this category, with "Why we ask" and Skip. Answering re-scores in place.
8. **Options:** 2 or 3 side by side: £ and kg (range or typical), effort, trade-off, approval tier, commission note if any.
9. **Next step:** one primary button for the recommended option.
10. **Category extras:** the `soloExtras` blocks listed per category below.
11. **Context strip:** dated signals that apply.
12. **Related:** up to 2 cards from handoffs.
13. **Ask Zai:** secondary button, chat pre-loaded with this card's facts.
14. **Playback:** step rail when a task exists (found, asked, chose, approved, sent, confirmed, realised).

---

## 7. Context signals (`lib/intelligence/context.ts`, NEW)

| Signal | Source | Used by |
| --- | --- | --- |
| `price_cap_window` | data/facts.json (Ofgem dates) | utilities, money |
| `electricity_vat_window` | data/facts.json | utilities |
| `grant_window` | facts and library `window.reviewBy` | home, solar |
| `tax_year_end` | calendar (5 April) | money |
| `heating_season` | month Oct to Mar, existing `seasonHint` | home, utilities |
| `booking_season` | month Jan to Mar | holidays |
| `contract_deadline` | any account `contract_end_date` or `renewal_date` within 60 days | tech, utilities, travel, money, lifestyle |
| `follow_up_due` | `tasks.next_follow_up_at` | all |
| `grid_carbon_now` | NESO client | carbon, utilities, tech |
| `life_event` | zone agents (moved; NEW: new car, new baby, retired, new job) | all |

---

## 8. AI wording contract

One function, `writeCardCopy(card, context)`, through `lib/intelligence/aiGateway.ts`.

- Input: the card's finding template, filled facts, metrics, options, context, tone (`affluenceCheck` mode and goal).
- Output JSON: `{ headline, whyLine, optionLines[] }`, each under 140 characters, sentence case, no exclamation marks.
- **Number check:** extract every number and £ amount from the output; each must equal a value in the input (after formatting). Any mismatch or timeout: use the template wording, set `generated_by = 'fallback'`, `figure_check_passed = false`, log it.
- Never ask the model to calculate, estimate, rank or decide eligibility.

---

## 9. Category specs

Format per category: **Facts** (key, level, weight, from), **Metrics**, **Rules**, **Solo extras**, **Context**. Existing action ids in `code`; NEW ids need adding to `lib/actions/actionLibrary.ts` with source and `verifiedOn`.

### 9.1 Tech

**Facts**

| Key | Level | Weight | From |
| --- | --- | --- | --- |
| `smart_meter`, `smart_thermostat`, `smart_home` | L1 | 1 | onboarding tech |
| `broadband_provider` | L3 | 3 | account `broadband` / card question **NEW** `tech_broadband_provider` |
| `broadband_monthly_price` | L3 | 4 | account `monthly_amount_pence` |
| `broadband_contract_end` | L3 | 5 | account `contract_end_date` / card question **NEW** `tech_broadband_end` |
| `mobile_monthly_price`, `mobile_contract_end`, `mobile_handset_paid_off` | L3 | 3 to 4 | account `mobile` / card question **NEW** `tech_mobile_handset` |
| `streaming_services` (list with monthly prices) | L3/L4 | 3 | account `streaming` or bank |
| `receives_means_tested_benefit` | L2 | 4 | card question **NEW** `money_benefits_yes_no` (choice: yes, no, prefer not to say) |

**Metrics:** comms cost a month (sum of broadband, mobile, streaming prices; source: accounts or bank) · months out of contract (today minus contract end, broadband and mobile) · streaming services count and monthly total · next contract end date.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `tech.broadband_out_of_contract` | `broadband_contract_end` < today | `out-of-contract-broadband` | Switch provider (link, tier 2) · Haggle with your provider (script, tier 1) · Stay, remind me in 30 days (reminder, tier 1) |
| `tech.broadband_ending_soon` | contract end within 60 days | `out-of-contract-broadband` | Compare now · Remind me 2 weeks before |
| `tech.social_tariff` | `receives_means_tested_benefit` = yes | `social-broadband-tariff`, `mobile-social-tariff` | Check eligibility (link) · Not now |
| `tech.sim_only` | `mobile_handset_paid_off` = yes | **NEW** `sim-only-switch` | Switch to SIM-only (link) · Haggle (script) |
| `tech.streaming_overlap` | 2 or more streaming services | `cancel-unused-subscriptions` | Cancel one (checklist) · Move to an ad tier (link) · Rotate monthly (reminder) |

**Solo extras:** contract timeline (each service, start to end, today marker) · haggle script with the user's provider and price filled in.
**Context:** `contract_deadline`, `follow_up_due`.

### 9.2 Utilities

**Facts**

| Key | Level | Weight | From |
| --- | --- | --- | --- |
| `supplier` | L1 | 3 | core field `supplier` |
| `tariff_type` | L1 | 4 | onboarding utilities `tariff_type` |
| `monthly_energy_band` | L1 | 3 | onboarding utilities |
| `fix_end_date` | L2/L3 | 5 | account `energy_fix` / card question **NEW** `utilities_fix_end` |
| `energy_direct_debit` | L3 | 3 | account `electricity`/`gas` monthly amount |
| `account_credit_months` | L2 | 2 | card question **NEW** `utilities_in_credit` |
| `power_type`, `has_ev`, `has_heat_pump` | L1 | 3 | core `powerType`, onboarding travel `ev_hybrid`, home |
| `smart_meter` | L1 | 2 | onboarding tech |
| `financial_pressure` | L1 | 4 | core field |

**Metrics:** energy cost a month (direct debit, else band midpoint labelled "from your answer") · price cap typical bill and change (facts.json) · fix end date · days until fix ends.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `utilities.variable_vs_fix` | `tariff_type` = variable | `energy-tariff-compare` | Compare fixes (link, tier 2) · Stay on the cap (none) |
| `utilities.fix_ending` | fix ends within 49 days | `energy-tariff-compare` | Compare now · Remind me |
| `utilities.time_of_use` | `has_ev` or `has_heat_pump` | **NEW** `time-of-use-tariff` | Compare time-of-use tariffs · Not now |
| `utilities.in_credit` | `account_credit_months` ≥ 2 | **NEW** `energy-credit-refund` | Ask for a refund (letter, tier 1) · Lower the direct debit (script) |
| `utilities.support` | `financial_pressure` = TIGHT | `warm-home-discount`, `priority-services-register`, `energy-trust-debt-grant` | Check each (checklist) |
| `utilities.readings` | no smart meter | `submit-meter-reading`, `smart-meter-install` | Submit reading (reminder) · Book a smart meter (link) |

**Solo extras:** your rate vs the cap (bar: your direct debit vs typical cap bill, both sourced) · price cap calendar (next announcement and change dates).
**Context:** `price_cap_window`, `electricity_vat_window`, `heating_season`, `grid_carbon_now`.

### 9.3 Money

**Facts:** `financial_pressure` (L1, 5) · `employment_status`, `age_group`, `household`, `children` (L1, 3) · `council_tax_band` (L0, 3, public) · `single_occupier` (L1, 3, from household = ALONE) · `savings_rate` (L2, 3, card question **NEW** `money_savings_rate`) · `subscriptions` (L4, 3, bank) · `benefits_check_done` (L2, 4, card question **NEW** `money_benefits_checked`) · `monthly_outgoings` (L4, 4, bank).

**Metrics:** outgoings a month (L4 only) · subscriptions count and total · your savings rate vs Bank of England base rate (BoE client) · council tax band.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `money.benefits_first` | `financial_pressure` = TIGHT and `benefits_check_done` ≠ yes | `benefits-entitlement-check` (priority) | Run the check (link) · Done already (marks fact) |
| `money.single_person_discount` | `single_occupier` | `single-person-council-tax` | Apply (link) |
| `money.band_check` | band looks high for property type (L0 comparison, ≥ 5 peers) | `council-tax-band-challenge` | Check the band (link) · Not now |
| `money.savings_rate` | `savings_rate` < base rate | **NEW** `easy-access-savings-compare` | Compare accounts (link) |
| `money.marriage_allowance` | existing gates | `marriage-allowance` | Check (link) |
| `money.pension_age` | age RETIRED | `pension-credit`, `attendance-allowance` | Check each (checklist) |
| `money.unused_subscriptions` | bank shows recurring payment with no matching use signal | `cancel-unused-subscriptions` | Cancel (checklist) · Keep |

Debts: information only, never a product recommendation.
**Solo extras:** where your money goes (category split, L4 only) · entitlements checklist with status per item.
**Context:** `tax_year_end`, `price_cap_window`.

### 9.4 Lifestyle (NEW category, Z5)

**Facts:** `memberships` (L2/L3, 4: list of {type: gym | club | class | other, monthly price}, account `membership` / card question **NEW** `lifestyle_memberships`) · `membership_uses_per_month` (L2, 5, account `uses_per_month` / **NEW** `lifestyle_visits`) · `eating_out_per_week` (L2, 3, **NEW** `lifestyle_eat_out`: none, 1, 2 to 3, 4+) · `takeaway_app_subscription` (L2/L4, 2) · `pet_insurance_renewal` (L3, 3, account `pet_insurance`) · `leisure_concession_eligible` (derived from existing gates: age, employment, financial).

**Metrics:** memberships a month · cost per visit per membership (`monthly price / uses_per_month`) · eating out frequency · next pet insurance renewal.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `lifestyle.low_use_membership` | cost per visit > **NEW** threshold in facts.json for 2 months | **NEW** `membership-pause-or-downgrade` | Pause (script) · Off-peak (script) · Pay as you go (link) |
| `lifestyle.takeaway_subscription` | takeaway app subscription and fewer than 2 orders a month | `cancel-unused-subscriptions` | Cancel (checklist) · Keep |
| `lifestyle.pet_renewal` | renewal within 30 days | **NEW** `pet-insurance-renewal-check` | Compare quotes (link) · Ask for a better price (script) |
| `lifestyle.concessions` | `leisure_concession_eligible` | **NEW** `leisure-concession` | Check your council's scheme (link) |

**Copy rules:** value per use only; never "too much", "waste", body or health words. kg only with a published factor.
**Solo extras:** cost per visit bars per membership.
**Context:** `contract_deadline`.

### 9.5 Home

**Facts:** `tenure` (L1, 5) · `property_type`, `insulation_level`, `glazing_type` (L1, 3, onboarding home) · `epc_band`, `epc_potential`, `walls`, `loft`, `main_heating` (L0, 4, EPC) · `boiler_age_band` (L2, 3, **NEW** `home_boiler_age`) · `loft_depth` (L2, 3, `home_loft_insulate` or **NEW** `home_loft_depth`) · `flood_risk` (L0, 2) · `home_insurance_renewal` (L3, 3, account) · `heat_pump_interest` (L2, 2, `home_heat_pump`).

**Metrics:** EPC band now and potential · heating fuel and system · grants you may qualify for (count from eligible library actions) · next home insurance renewal.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `home.retrofit_grant` | tenure OWNER and EPC D to G | `boiler-upgrade-scheme`, `loft-insulation` | Check grants (checklist) · Get a retrofit assessment first (link) |
| `home.renter_standard` | tenure RENTER and EPC below C | **NEW** `landlord-epc-letter` | Send your landlord a letter (letter, tier 2) · Renter-safe fixes (checklist) |
| `home.quick_wins` | heating season | `heating-controls-timing`, `boiler-flow-temperature`, `bleed-radiators`, `radiator-reflector-panels`, `draught-proofing-renter-safe`, `led-bulb-swap` | Pick one (checklist) |
| `home.flood` | flood risk medium or high | **NEW** `flood-re-insurance-check` | Check cover (link) |
| `home.insurance_renewal` | renewal within 30 days | **NEW** `home-insurance-renewal-check` | Compare (link) · Haggle (script) |

**Solo extras:** EPC ladder (current band to potential, which measures move it, from EPC recommendations) · grant eligibility checklist.
**Context:** `heating_season`, `grant_window`, `contract_deadline`.

### 9.6 Water

**Facts:** `supplier_water` (L0, 2) · `metered` (L2, 5, `water_meter_save` or **NEW** `water_metered`) · `occupants` (L1, 4, household) · `bedrooms` (L0, 3, EPC or property) · `water_bill_year` (L3, 4, account `water`) · `wash_preference`, `garden_butt` (L1, 1) · `financial_pressure` (L1, 4).

**Metrics:** water bill a year · metered or not · people vs bedrooms · supplier.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `water.meter` | not metered and occupants < bedrooms | `water-meter-switch` | Apply for a meter (link) · Not now |
| `water.social` | `financial_pressure` = TIGHT | `water-social-tariff`, `watersure-cap` | Check (checklist) |
| `water.use` | always (low effort) | `shorter-shower`, `shallower-bath`, `low-flow-shower-head` | Pick one (checklist) |

**Solo extras:** meter decision helper (inputs shown, no invented figure).
**Context:** none.

### 9.7 Travel

**Facts:** `commute_distance`, `ev_hybrid`, `public_transport` (L1, 3) · `transport` (core, 3) · `weekly_miles` (L2, 4, **NEW** `travel_weekly_miles`) · `car_insurance_renewal`, `mot_due`, `vehicle_tax_due` (L3, 4, accounts) · `rail_trips_per_month` (L2, 3, **NEW** `travel_rail_trips`) · `age_group`, `employment_status` (L1, 2).

**Metrics:** next car renewal (insurance, MOT, tax) · weekly miles · main transport · rail trips a month.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `travel.insurance_renewal` | renewal within 30 days | `car-insurance-never-autorenew` | Compare (link) · Haggle (script) |
| `travel.low_mileage` | weekly miles low band | **NEW** `pay-per-mile-insurance` | Compare pay-per-mile (link) |
| `travel.railcard` | rail trips ≥ 2 a month | `railcard`, `senior-railcard`, `student-railcard` (by age and employment) | Buy railcard (link) |
| `travel.ev_salary_sacrifice` | employed and `travel_ev_commute` = yes | **NEW** `ev-salary-sacrifice` | Ask your employer (letter) |
| `travel.running_costs` | drives | `car-tyre-pressure`, `fuel-price-check` | Pick one |
| `travel.bus` | bus user or concession age | `bus-fare-cap`, `older-persons-bus-pass` | Check (link) |

**Solo extras:** car calendar (insurance, MOT, tax on one line).
**Context:** `contract_deadline`, `life_event` (new car).

### 9.8 Holidays

**Facts:** `annual_flights`, `flight_duration`, `carbon_offsets` (L1, 3) · `trips_per_year` (L2, 3, `holidays_local_vs_longhaul`) · `rail_open` (L2, 2, `holidays_train_not_plane`) · `travel_insurance` (L3, 3, account `travel_insurance` / **NEW** `holidays_insurance_type`: single, annual, none).

**Metrics:** trips a year · flights a year · insurance type and renewal · travel kg CO2e (published factors only).

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `holidays.annual_cover` | trips ≥ 2 and insurance single or none | **NEW** `annual-travel-insurance` | Compare annual cover (link) |
| `holidays.ghic` | travels in Europe | **NEW** `ghic-free-card` | Apply on the official site (link) |
| `holidays.rail_option` | short-haul flights and `rail_open` = yes | **NEW** `rail-instead-of-short-flight` | See rail routes (link) |

**Solo extras:** trip planner prompt for Ask Zai.
**Context:** `booking_season`.

### 9.9 Food

**Facts:** `diet_profile`, `organic_shopping`, `own_produce` (L1, 2) · `weekly_shop_band` (L2, 4, **NEW** `food_weekly_shop`) · `main_supermarket` (L2, 3, **NEW** `food_supermarket`) · `food_waste_level` (L2, 3, `food_waste_cut`) · `children`, `financial_pressure` (L1, 4).

**Metrics:** weekly shop band · main supermarket · food waste level · food kg CO2e (factor-based only).

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `food.entitlements` | existing `requires` gates | `healthy-start-card`, `free-school-meals` | Apply (link) |
| `food.surplus` | `financial_pressure` TIGHT or GETTING_BY | `surplus-food-app`, `community-food-club` | Find near you (link) |
| `food.waste` | waste level medium or high | **NEW** `food-waste-planning` | Plan and store tips (checklist) |
| `food.loyalty` | main supermarket known | **NEW** `supermarket-loyalty-prices` | Check member prices (link) |

**Copy rules:** no diet judgement, no health claims.
**Context:** none.

### 9.10 Shopping

**Facts:** `retail_channel`, `repair_mindset`, `online_deliveries` (L1, 2) · `planned_big_purchase` (L2, 4, **NEW** `shopping_planned_purchase`: appliance, tech, furniture, none) · `repair_first` (L2, 2, `shopping_repair_first`) · `student` (L1, 2).

**Metrics:** planned purchase · repair first · delivery frequency.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `shopping.appliance_running_cost` | planned appliance | **NEW** `energy-label-compare` | Compare running costs (link) |
| `shopping.refurbished` | planned tech | `refurbished-tech` | See refurbished (link) |
| `shopping.repair` | repair mindset open | `repair-not-replace` | Find a repair (link) |
| `shopping.student` | student | `student-totum-discount` | Check (link) |

**Context:** none.

### 9.11 Solar

**Facts:** `tenure` (L1, 5) · `roof_orientation`, `roof_shading`, `daytime_occupancy` (L1, 4) · `pvgis_kwh_year` (L0, 4, PVGIS) · `irradiance` (L0, 2) · `has_panels` (L2, 5, `solar_roof_fit`) · `has_battery` (L2, 3, **NEW** `solar_battery`) · `export_tariff` (L2, 3, **NEW** `solar_export_tariff`).

**Metrics:** likely kWh a year (PVGIS for orientation) · panels and battery status · export tariff · kg CO2e avoided (grid factor from facts.json).

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `solar.export` | has panels and no export tariff | `solar-export-guarantee` | Compare export tariffs (link) |
| `solar.quotes` | owner, roof suitable, no panels | **NEW** `solar-mcs-quotes` | Get MCS quotes (link) · Not now |
| `solar.battery` | panels, no battery, high evening use | **NEW** `solar-battery-check` | Check (link) |

**Context:** `grant_window`.

### 9.12 Waste

**Facts:** `food_waste_collection`, `composting`, `soft_plastics` (L1, 2) · `council_collections` (L0, 3, Defra) · `garden_waste_subscription` (L2, 3, **NEW** `waste_garden_sub`) · `compost_open` (L2, 2, `waste_compost`).

**Metrics:** collection days · garden waste subscription · food caddy use.

**Rules**

| Id | When | Actions | Options |
| --- | --- | --- | --- |
| `waste.reuse` | always | `freegle-local-reuse` | Find local reuse (link) |
| `waste.compost` | garden waste subscribed and `compost_open` | **NEW** `home-compost` | Compost at home (checklist) |
| `waste.food_caddy` | food waste collection available, not used | **NEW** `food-caddy-request` | Request a caddy (link) |

**Context:** none.

### 9.13 Carbon

No facts of its own. **Metrics:** household kg CO2e by category (sum of category kg where a factor exists; categories without one show "Not known yet") · biggest lever (category with the largest kg range from ranked actions) · grid carbon now (NESO) · kg cut so far (from realised tasks).
**Rules:** `carbon.biggest_lever` links to that category's top card · `carbon.shift_tonight` when grid intensity is forecast lower tonight: shift washing and charging (`washing-machine-30`, `economy-7-check`).
**Context:** `grid_carbon_now`.

---

## 10. New library actions to add (with sources before shipping)

`sim-only-switch`, `time-of-use-tariff`, `energy-credit-refund`, `easy-access-savings-compare`, `membership-pause-or-downgrade`, `pet-insurance-renewal-check`, `leisure-concession`, `landlord-epc-letter`, `flood-re-insurance-check`, `home-insurance-renewal-check`, `pay-per-mile-insurance`, `ev-salary-sacrifice`, `annual-travel-insurance`, `ghic-free-card`, `rail-instead-of-short-flight`, `food-waste-planning`, `supermarket-loyalty-prices`, `energy-label-compare`, `solar-mcs-quotes`, `solar-battery-check`, `home-compost`, `food-caddy-request`.

Each needs: `action`, `detail`, `verb`, `cost`, `recurrence`, `bucket`, `valueGbp` and `valueKg` (0 if no sourced figure), `url` (a form, checker or comparison, never an explainer), `source`, `verifiedOn`, gates. Also refresh the 53 actions verified 31 Jul 2026 and add `reviewBy` to all.

## 11. New questions to add (to `LOOP_QUESTION_BANK`, choice answers unless stated)

`tech_broadband_provider` (provider picker), `tech_broadband_end` (date), `tech_mobile_handset` (paid off: yes, no, not sure), `money_benefits_yes_no` (yes, no, prefer not to say), `money_savings_rate` (band), `money_benefits_checked`, `utilities_fix_end` (date), `utilities_in_credit` (no, about 1 month, 2 or more), `lifestyle_memberships` (multi choice), `lifestyle_visits` (per membership: 0, 1 to 3, 4 to 8, 9+), `lifestyle_eat_out`, `home_boiler_age` (under 5, 5 to 10, 10 to 15, over 15, not sure), `home_loft_depth`, `water_metered`, `travel_weekly_miles` (band), `travel_rail_trips`, `holidays_insurance_type`, `food_weekly_shop` (band), `food_supermarket` (picker), `shopping_planned_purchase`, `solar_battery`, `solar_export_tariff`, `waste_garden_sub`.

Every question carries: `questionId`, `journeyId`, `fieldKey`, `whyWeAsk` (one line), answer type, options, and which rules it gates.

## 12. Acceptance tests (synthetic households)

| Story | Expected |
| --- | --- |
| Broadband ended 4 months ago | Hero = `tech.broadband_out_of_contract`; options switch, haggle, remind; confidence high if from account, medium if told us |
| Gym 1 visit a month | `lifestyle.low_use_membership` with cost per visit computed and sourced to the account |
| Renter, EPC E | `home.renter_standard` shown; `home.retrofit_grant` not shown |
| Owner, EPC D, gas boiler 15 years | `home.retrofit_grant` with BUS from the library; boiler question not asked again |
| Variable tariff, fix ends in 20 days | `utilities.fix_ending` ranks above `utilities.variable_vs_fix` |
| Single occupier | `money.single_person_discount` shown |
| Guest, postcode only | Only L0 cards; every Solo Focus metric needing L1+ shows "Not known yet" with its question |
| AI returns a number not in facts | Fallback wording used; `figure_check_passed = false` logged |
| Question skipped | Not shown again for 30 days |
| Fact deleted on What we know | Every card using it re-scores; dependent metrics show "Not known yet" |
