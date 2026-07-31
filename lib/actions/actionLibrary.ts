/**
 * The action library — seeded with the renter + TIGHT column first, deliberately.
 *
 * That column is the hardest one to fill: you can't change the building, and you can't spend
 * money, so it has the fewest available moves and the least room for the "just buy a better one"
 * advice that pads out the easy columns. If twelve genuinely strong actions exist here, every
 * other column is easier. Building it first also stops the whole system quietly being designed
 * around a homeowner with spare cash, which is the trap the old 12-category wall fell into.
 *
 * Every entry was verified against a live source on the date in `verifiedOn`. Two things that
 * check caught, both of which would have shipped as confident nonsense:
 *   - Warm Home Discount was CLOSED at time of writing (reopens Oct 2026) and is automatic in
 *     England and Wales — so "apply now" would be wrong twice over.
 *   - The Household Support Fund ENDED on 31 March 2026, replaced by the Crisis and Resilience
 *     Fund, so it is deliberately absent rather than pointing at a dead scheme.
 *
 * Rule for adding anything here: if the URL goes to something you read rather than something you
 * do, it is not an action and does not belong.
 */

import type { ZoneAction } from '@/lib/actions/actionTypes'
import { isValidJourneyId } from '@/lib/journeys'

/**
 * Card slugs the `/zone/card/[journeyKey]` route must resolve. A ranked wall can return several
 * cards from the same bucket, so cards are addressed by action id; the legacy per-category slugs
 * stay valid for the guest wall.
 */
export function isValidZoneCardSlug(slug: string): boolean {
  const s = String(slug ?? '').trim()
  if (!s) return false
  if (isValidJourneyId(s)) return true
  return ZONE_ACTIONS.some((a) => a.id === s)
}

export const ZONE_ACTIONS: ZoneAction[] = [
  // ---------------------------------------------------------------------------------------
  // CLAIM — entitlements. Highest value per slot, cost nothing, and are massively underclaimed.
  // ---------------------------------------------------------------------------------------
  {
    id: 'benefits-entitlement-check',
    action: 'Check what you are owed',
    detail:
      'Around 7 million UK households miss entitlements worth an average £3,428 a year. The check is free and takes about ten minutes.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ANNUAL',
    bucket: 'money',
    valueGbp: 3428,
    valueKg: 0,
    url: 'https://benefits-calculator.turn2us.org.uk/',
    source: 'Policy in Practice, Missing Out 2025 (£24bn unclaimed, ~7m households); Turn2us calculator',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
    // Unlocks every other means-tested action, so it should lead rather than land at slot nine.
    priorityBoost: 40,
  },
  {
    id: 'council-tax-reduction',
    action: 'Apply for Council Tax Reduction',
    detail:
      'Worth up to 100% off your bill on a low income. It is never applied automatically and your council will not offer it — you have to apply.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'money',
    valueGbp: 1200,
    valueKg: 0,
    url: 'https://www.gov.uk/apply-council-tax-reduction',
    source: 'GOV.UK Council Tax Reduction; schemes are council-run and vary by area',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
    priorityBoost: 30,
  },
  {
    id: 'single-person-council-tax',
    action: 'Claim the single-adult discount',
    detail:
      'If you are the only adult counted at your address, 25% comes off your Council Tax. It is not applied automatically.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'money',
    valueGbp: 500,
    valueKg: 0,
    url: 'https://www.gov.uk/apply-for-council-tax-discount',
    source: 'GOV.UK Council Tax discounts — 25% single person discount',
    verifiedOn: '2026-07-31',
    requires: { household: ['ALONE'] },
    priorityBoost: 25,
  },
  {
    id: 'healthy-start-card',
    action: 'Get a Healthy Start card',
    detail:
      'Up to £483 a year for a baby under one, or £241.80 for pregnancy and ages one to four, loaded onto a card for milk, fruit and veg.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'food',
    valueGbp: 483,
    valueKg: 0,
    url: 'https://www.healthystart.nhs.uk/how-to-apply/',
    source: 'NHS Healthy Start — rates from April 2026 (£483 under 1; £241.80 ages 1-4/pregnancy)',
    verifiedOn: '2026-07-31',
    // Needs an actual under-5 (or pregnancy, which onboarding doesn't ask). `requires`, not
    // `gates`: if we don't know there's a small child, we must not claim they can get this.
    requires: { children: ['UNDER_5', 'BOTH'] },
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
  },
  {
    id: 'free-school-meals',
    action: 'Apply for free school meals',
    detail:
      'Saves roughly £500 a year per child and also unlocks extra funding for their school. Applying takes a few minutes.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'food',
    valueGbp: 500,
    valueKg: 0,
    url: 'https://www.gov.uk/apply-free-school-meals',
    source: 'GOV.UK apply for free school meals',
    verifiedOn: '2026-07-31',
    // Needs a school-age child specifically — an under-5 household gets nothing from this.
    requires: { children: ['SCHOOL_AGE', 'BOTH'] },
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
  },
  {
    id: 'nhs-low-income-scheme',
    action: 'Apply to the NHS Low Income Scheme',
    detail:
      'An HC2 certificate means free prescriptions, dental treatment and eye tests. You can qualify while working.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ANNUAL',
    bucket: 'money',
    valueGbp: 300,
    valueKg: 0,
    url: 'https://www.nhsbsa.nhs.uk/nhs-low-income-scheme',
    source: 'NHSBSA NHS Low Income Scheme — HC2 full help, HC3 partial help',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
  },
  {
    id: 'watersure-cap',
    action: 'Cap your water bill with WaterSure',
    detail:
      'Caps your metered bill at the regional average if you claim a qualifying benefit and either have three or more children or a medical need.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ANNUAL',
    bucket: 'water',
    valueGbp: 200,
    valueKg: 0,
    url: 'https://www.citizensadvice.org.uk/consumer/water/problems-with-paying-your-water-bill/watersure-scheme-help-with-paying-water-bills/',
    source: 'Citizens Advice WaterSure — requires meter plus qualifying benefit plus high essential use',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
  },
  {
    id: 'warm-home-discount',
    action: 'Line up your Warm Home Discount',
    detail:
      '£150 off your electricity bill. In England and Wales it is automatic on a qualifying benefit — check your supplier takes part before the scheme reopens.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ANNUAL',
    bucket: 'utilities',
    valueGbp: 150,
    valueKg: 0,
    url: 'https://www.gov.uk/the-warm-home-discount-scheme',
    source: 'GOV.UK / Ofgem Warm Home Discount — scheme year 16 runs 1 Apr 2026 to 31 Mar 2027',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
    // Closed at time of writing, reopening October 2026 — surfacing it earlier would tell people
    // to claim something they cannot currently claim.
    window: { months: [9, 10, 11, 12, 1, 2, 3], reviewBy: '2027-03-31' },
  },
  {
    id: 'priority-services-register',
    action: 'Join the Priority Services Register',
    detail:
      'Free from every energy supplier. Gets you priority reconnection, free meter moves and advance warning of outages.',
    verb: 'CLAIM',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'utilities',
    valueGbp: 0,
    valueKg: 0,
    url: 'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/getting-extra-help-priority-services-register',
    source: 'Ofgem Priority Services Register — free scheme run by suppliers',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
  },

  // ---------------------------------------------------------------------------------------
  // SWITCH — free to do, permanent saving, and available to renters.
  // ---------------------------------------------------------------------------------------
  {
    id: 'social-broadband-tariff',
    action: 'Move to a social broadband tariff',
    detail:
      'From about £12.50 a month on a qualifying benefit, with no mid-contract price rises. Only 8.6% of eligible homes have taken one.',
    verb: 'SWITCH',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'tech',
    valueGbp: 200,
    valueKg: 0,
    url: 'https://www.ofcom.org.uk/phones-and-broadband/saving-money/social-tariffs',
    source: 'Ofcom social tariffs — 532,000 of 6.2m eligible households taking one (8.6%), Feb 2026',
    verifiedOn: '2026-07-31',
    gates: { financial: ['TIGHT', 'GETTING_BY'] },
    priorityBoost: 20,
  },
  {
    id: 'water-meter-switch',
    action: 'Check if a water meter pays',
    detail:
      'Free to fit, and you can switch back within two years. Best if you have more bedrooms than people. Renters can do this without the landlord.',
    verb: 'SWITCH',
    cost: 'FREE',
    recurrence: 'ONCE',
    bucket: 'water',
    valueGbp: 100,
    valueKg: 0,
    url: 'https://www.ccw.org.uk/save-money-and-water/water-meter-calculator/',
    source: 'CCW water meter calculator — free install, 24-month switch back, renters need 6+ month lease',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'energy-tariff-compare',
    action: 'Compare your energy tariff',
    detail:
      'Standing charges and unit rates vary by supplier and region. Comparing costs nothing and switching is free.',
    verb: 'SWITCH',
    cost: 'FREE',
    recurrence: 'ANNUAL',
    bucket: 'utilities',
    valueGbp: 120,
    valueKg: 0,
    url: 'https://www.moneysavingexpert.com/cheapenergyclub/',
    source: 'MSE Cheap Energy Club',
    verifiedOn: '2026-07-31',
  },

  // ---------------------------------------------------------------------------------------
  // DO — free behaviour. Lowest £ per slot, so these rank last and act as the safety net that
  // stops any column ever coming up short.
  // ---------------------------------------------------------------------------------------
  {
    id: 'submit-meter-reading',
    action: 'Send a meter reading today',
    detail:
      'Estimated bills routinely run high. One reading forces your account back onto what you actually used.',
    verb: 'DO',
    cost: 'FREE',
    recurrence: 'ONGOING',
    bucket: 'utilities',
    valueGbp: 60,
    valueKg: 0,
    url: 'https://www.citizensadvice.org.uk/consumer/energy/energy-supply/problems-with-your-energy-supply/problems-with-your-energy-bill/',
    source: 'Citizens Advice — energy billing and meter readings',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'heating-controls-timing',
    action: 'Set heating to hours you are home',
    detail:
      'Costs nothing and needs no permission from a landlord. Heating an empty flat is the most common avoidable spend in winter.',
    verb: 'DO',
    cost: 'FREE',
    recurrence: 'ONGOING',
    bucket: 'home',
    valueGbp: 80,
    valueKg: 300,
    url: 'https://energysavingtrust.org.uk/advice/thermostats-and-heating-controls/',
    source: 'Energy Saving Trust — thermostats and heating controls',
    verifiedOn: '2026-07-31',
    window: { months: [10, 11, 12, 1, 2, 3] },
  },
  {
    id: 'surplus-food-app',
    action: 'Pick up surplus food nearby',
    detail:
      'Shops and cafes sell unsold food at about a third of the price at closing time through Too Good To Go.',
    verb: 'DO',
    cost: 'FREE',
    recurrence: 'ONGOING',
    bucket: 'food',
    valueGbp: 150,
    valueKg: 100,
    url: 'https://www.toogoodtogo.com/en-gb',
    source: 'Too Good To Go UK — surplus food marketplace',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'freegle-local-reuse',
    action: 'Get what you need free locally',
    detail:
      'Freegle has 4 million UK members giving away furniture, appliances and household kit rather than tipping it.',
    verb: 'DO',
    cost: 'FREE',
    recurrence: 'ONGOING',
    bucket: 'waste',
    valueGbp: 120,
    valueKg: 80,
    url: 'https://www.ilovefreegle.org/find',
    source: 'Freegle — UK reuse network, registered charity XT32865',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'repair-not-replace',
    action: 'Get it repaired free first',
    detail:
      'Community repair events fix laptops, kettles and phones for nothing, run by volunteers across the UK.',
    verb: 'DO',
    cost: 'FREE',
    recurrence: 'ONGOING',
    bucket: 'shopping',
    valueGbp: 100,
    valueKg: 60,
    url: 'https://therestartproject.org/parties/',
    source: 'The Restart Project — community repair events directory',
    verifiedOn: '2026-07-31',
  },

  // ---------------------------------------------------------------------------------------
  // Owner-only and paid actions. Present so the ranker has something to exclude and so the
  // other columns aren't empty — every one carries a renter exclusion.
  // ---------------------------------------------------------------------------------------
  {
    id: 'loft-insulation',
    action: 'Insulate the loft',
    detail: 'Cuts heat loss through the roof, the single largest escape route in most houses.',
    verb: 'BUY',
    cost: 'HIGH',
    recurrence: 'ONCE',
    bucket: 'home',
    valueGbp: 250,
    valueKg: 900,
    url: 'https://www.gov.uk/improve-energy-efficiency',
    source: 'GOV.UK find ways to save energy in your home',
    verifiedOn: '2026-07-31',
    requires: { tenure: ['OWNER'] },
    // A renter cannot act on this at any price. Hard exclusion, never a ranking penalty.
    excludes: { tenure: ['RENTER'] },
  },
  {
    id: 'solar-export-guarantee',
    action: 'Get paid for exported solar',
    detail:
      'Every large supplier must offer a Smart Export Guarantee tariff for power your panels send back.',
    verb: 'CLAIM',
    cost: 'HIGH',
    recurrence: 'ONCE',
    bucket: 'solar',
    valueGbp: 400,
    valueKg: 800,
    url: 'https://www.ofgem.gov.uk/environmental-and-social-schemes/smart-export-guarantee-seg',
    source: 'Ofgem Smart Export Guarantee',
    verifiedOn: '2026-07-31',
    requires: { tenure: ['OWNER'] },
    excludes: { tenure: ['RENTER'] },
  },
  {
    id: 'boiler-upgrade-scheme',
    action: 'Use the Boiler Upgrade Scheme',
    detail: 'A government grant toward replacing a gas boiler with a heat pump.',
    verb: 'CLAIM',
    cost: 'HIGH',
    recurrence: 'ONCE',
    bucket: 'home',
    valueGbp: 300,
    valueKg: 1200,
    url: 'https://www.gov.uk/apply-boiler-upgrade-scheme',
    source: 'GOV.UK Boiler Upgrade Scheme',
    verifiedOn: '2026-07-31',
    requires: { tenure: ['OWNER'], heating: ['GAS'] },
    excludes: { tenure: ['RENTER'] },
  },
  {
    id: 'low-flow-shower-head',
    action: 'Fit a flow-limited shower head',
    detail: 'Cuts hot water use without losing pressure, and unscrews again when you move out.',
    verb: 'BUY',
    cost: 'LOW',
    recurrence: 'ONCE',
    bucket: 'water',
    valueGbp: 80,
    valueKg: 120,
    url: 'https://www.waterwise.org.uk/save-water/',
    source: 'Waterwise — an efficient shower head could reduce household bills by up to £120/yr',
    verifiedOn: '2026-07-31',
    gates: { wash: ['SHOWER', 'BOTH'] },
  },
  {
    id: 'refurbished-tech',
    action: 'Buy refurbished, not new',
    detail: 'Up to 70% below new, with a 12-month warranty and 30-day returns.',
    verb: 'BUY',
    cost: 'HIGH',
    recurrence: 'ONGOING',
    bucket: 'tech',
    valueGbp: 200,
    valueKg: 150,
    url: 'https://www.backmarket.co.uk/en-gb',
    source: 'Back Market UK — refurbished marketplace, 12-month warranty',
    verifiedOn: '2026-07-31',
  },
  {
    id: 'railcard',
    action: 'Get a railcard',
    detail: 'A third off most fares for £30 a year, which pays for itself in about two trips.',
    verb: 'BUY',
    cost: 'LOW',
    recurrence: 'ANNUAL',
    bucket: 'travel',
    valueGbp: 167,
    valueKg: 200,
    url: 'https://www.railcard.co.uk/',
    source: 'Railcard.co.uk — 1/3 off, £30/yr; Trainline cites £167 average annual saving',
    verifiedOn: '2026-07-31',
    gates: { transport: ['PUBLIC', 'MIX', 'CAR'] },
  },
  {
    id: 'ethical-isa',
    action: 'Move savings somewhere fossil-free',
    detail: 'Triodos publishes every organisation it finances, and its cash ISA is FSCS protected.',
    verb: 'SWITCH',
    cost: 'HIGH',
    recurrence: 'ONCE',
    bucket: 'money',
    valueGbp: 0,
    valueKg: 400,
    url: 'https://www.triodos.co.uk/ethical-isas',
    source: 'Triodos Bank UK — ethical ISA range, FSCS protected to £120k',
    verifiedOn: '2026-07-31',
    gates: { financial: ['DOING_OK'] },
    // Suggesting where to park savings to someone with none is the clearest possible signal
    // that the app has not listened.
    excludes: { financial: ['TIGHT'] },
  },
]
