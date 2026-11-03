/** Water — docs/INTELLIGENCE-LOGIC.md §9.6. Metering decision shown from inputs, no invented figure. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

const notMetered = (v: string | null) => v === 'NO METER' || v === 'NO'

export const water: CategorySpec = {
  id: 'water',
  depth: 'basic',
  facts: CATEGORY_FACTS.water,
  metrics: [
    factMetric('water_bill_year', 'Water bill a year', 'gbp_year', 'Your monthly water amount × 12.'),
    factMetric('metered', 'Water meter', 'text', 'What you told us.'),
    {
      key: 'people_vs_bedrooms',
      label: 'People and bedrooms',
      unit: 'text',
      needs: ['occupants', 'bedrooms'],
      computeNote: 'People at home against bedrooms; fewer people than bedrooms often favours a meter.',
      compute: (ctx) => {
        const p = ctx.num('occupants')
        const b = ctx.num('bedrooms')
        return p === null || b === null ? null : { value: `${p} people, ${b} bedrooms`, from: ['occupants', 'bedrooms'] }
      },
    },
    factMetric('supplier_water', 'Water supplier', 'text', 'From your postcode.'),
  ],
  rules: [
    {
      id: 'water.meter',
      whenNote: 'not metered and fewer people than bedrooms',
      when: (ctx) => {
        const p = ctx.num('occupants')
        const b = ctx.num('bedrooms')
        return notMetered(ctx.str('metered')) && p !== null && b !== null && p < b
      },
      finding: () => 'Fewer people than bedrooms and no water meter: a meter may cost less',
      drivers: ['metered', 'occupants', 'bedrooms'],
      actions: ['water-meter-switch'],
      options: [
        { key: 'apply', label: 'Apply for a meter', actionId: 'water-meter-switch', effortMinutes: 10, approvalTier: 1, tradeOff: 'In England and Wales you can usually switch back within two years.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'water.social',
      whenNote: 'financial_pressure = TIGHT',
      when: (ctx) => ctx.str('financial_pressure') === 'TIGHT',
      finding: () => 'There is help with water bills you could check',
      drivers: ['financial_pressure'],
      actions: ['water-social-tariff', 'watersure-cap'],
      options: [
        { key: 'check', label: 'Check both schemes', actionId: 'water-social-tariff', effortMinutes: 15, approvalTier: 1, tradeOff: 'Each supplier runs its own scheme.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'water.use',
      whenNote: 'always (low effort)',
      when: () => true,
      finding: () => 'Small changes to hot water use, at no cost',
      drivers: ['wash_preference'],
      actions: ['shorter-shower', 'shallower-bath', 'low-flow-shower-head'],
      options: [
        { key: 'pick', label: 'Pick one to try', actionId: 'shorter-shower', effortMinutes: 5, approvalTier: 0, tradeOff: 'Small on its own; it adds up over a year.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: ['meter_decision_helper'],
  context: [],
  agents: ['moving'],
}
