/** Travel — docs/INTELLIGENCE-LOGIC.md §9.7. Renewals, railcards, running costs. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, longDate, OPTION_NOT_NOW, soonestDateMetric, within } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const travel: CategorySpec = {
  id: 'travel',
  depth: 'basic',
  facts: CATEGORY_FACTS.travel,
  metrics: [
    soonestDateMetric('next_car_renewal', 'Next car renewal', ['car_insurance_renewal', 'mot_due', 'vehicle_tax_due']),
    factMetric('weekly_miles', 'Miles a week', 'band', 'The band you told us.'),
    factMetric('transport', 'Main way you get around', 'text', 'What you told us at sign-up.'),
    factMetric('rail_trips_per_month', 'Train trips a month', 'band', 'The band you told us.'),
  ],
  rules: [
    {
      id: 'travel.insurance_renewal',
      whenNote: 'car insurance renews within 30 days',
      when: (ctx) => within(ctx.days('car_insurance_renewal'), 0, 30),
      finding: (ctx) => `Your car insurance renews on ${longDate(ctx.date('car_insurance_renewal') as string)}`,
      drivers: ['car_insurance_renewal'],
      actions: ['car-insurance-never-autorenew'],
      deadlineFact: 'car_insurance_renewal',
      options: [
        { key: 'compare', label: 'Compare quotes', actionId: 'car-insurance-never-autorenew', effortMinutes: 20, approvalTier: 2, tradeOff: 'Check the excess and cover match, not just the price.', prepares: 'link' },
        { key: 'haggle', label: 'Ask your insurer for a better price', effortMinutes: 15, approvalTier: 1, tradeOff: 'They may say no; your cover carries on.', prepares: 'script' },
      ],
    },
    {
      id: 'travel.ev_salary_sacrifice',
      whenNote: 'employed and travel_ev_commute = yes',
      when: (ctx) => ctx.str('employment_status') === 'EMPLOYED' && (ctx.h.answers.travel_ev_commute ?? '').toUpperCase().startsWith('YES'),
      finding: () => 'An electric car through work could cost less than buying one',
      drivers: ['employment_status', 'ev_hybrid'],
      actions: ['ev-salary-sacrifice'],
      options: [
        { key: 'ask', label: 'Ask your employer', actionId: 'ev-salary-sacrifice', effortMinutes: 15, approvalTier: 2, tradeOff: 'Not every employer offers a scheme.', prepares: 'letter' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'travel.running_costs',
      whenNote: 'drives (transport CAR or MIX)',
      when: (ctx) => ['CAR', 'MIX'].includes(ctx.str('transport') ?? ''),
      finding: () => 'Two free checks that cut what your car costs to run',
      drivers: ['transport'],
      actions: ['car-tyre-pressure', 'fuel-price-check'],
      options: [
        { key: 'pick', label: 'Pick one', actionId: 'car-tyre-pressure', effortMinutes: 10, approvalTier: 0, tradeOff: 'Small each time; it adds up over a year.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'travel.bus',
      whenNote: 'bus user or concession age',
      when: (ctx) => ctx.str('transport') === 'PUBLIC' || ctx.str('age_group') === 'RETIRED',
      finding: () => 'Bus fares are capped, and some passes are free',
      drivers: ['transport', 'age_group'],
      actions: ['bus-fare-cap', 'older-persons-bus-pass'],
      options: [
        { key: 'check', label: 'Check what applies', actionId: 'bus-fare-cap', effortMinutes: 10, approvalTier: 1, tradeOff: 'Caps and passes differ across the UK.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: ['car_calendar'],
  context: ['contract_deadline', 'life_event'],
  agents: [],
}
