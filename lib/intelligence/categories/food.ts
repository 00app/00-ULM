/** Food — docs/INTELLIGENCE-LOGIC.md §9.9. No diet judgement, no health claims. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const food: CategorySpec = {
  id: 'food',
  depth: 'basic',
  facts: CATEGORY_FACTS.food,
  metrics: [
    factMetric('weekly_shop_band', 'Weekly shop', 'band', 'The band you told us.'),
    factMetric('main_supermarket', 'Main supermarket', 'text', 'What you told us.'),
    factMetric('food_waste_level', 'Cutting food waste', 'text', 'Your answer to the food waste question.'),
    {
      key: 'food_kg',
      label: 'Food kg CO2e a year',
      unit: 'kg_year',
      needs: ['diet_profile'],
      referenceField: 'reference:food_emission_factor',
      computeNote: 'Factor-based only; no published factor is wired yet.',
      compute: () => null,
    },
  ],
  rules: [
    {
      id: 'food.entitlements',
      whenNote: 'the library actions’ own requires gates pass',
      when: (ctx) => ctx.eligible.has('healthy-start-card') || ctx.eligible.has('free-school-meals'),
      finding: () => 'Your children may qualify for free food support',
      drivers: ['children', 'financial_pressure'],
      actions: ['healthy-start-card', 'free-school-meals'],
      options: [
        { key: 'apply', label: 'Apply', actionId: 'free-school-meals', effortMinutes: 15, approvalTier: 1, tradeOff: 'You need proof of the benefit you receive.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'food.surplus',
      whenNote: 'financial_pressure TIGHT or GETTING_BY',
      when: (ctx) => ['TIGHT', 'GETTING_BY'].includes(ctx.str('financial_pressure') ?? ''),
      finding: () => 'Surplus food apps and food clubs sell good food for less',
      drivers: ['financial_pressure'],
      actions: ['surplus-food-app', 'community-food-club'],
      options: [
        { key: 'find', label: 'Find one near you', actionId: 'surplus-food-app', effortMinutes: 10, approvalTier: 1, tradeOff: 'What is available changes day to day.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'food.waste',
      whenNote: 'not yet cutting food waste',
      when: (ctx) => ['NOT YET', 'SHOW TIPS'].includes(ctx.str('food_waste_level') ?? ''),
      finding: () => 'Planning and storing food well means less goes in the bin',
      drivers: ['food_waste_level'],
      actions: ['food-waste-planning'],
      options: [
        { key: 'tips', label: 'Plan and store tips', actionId: 'food-waste-planning', effortMinutes: 10, approvalTier: 0, tradeOff: 'Takes a few minutes of planning each week.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: [],
  context: [],
  agents: [],
}
