/** Shopping — docs/INTELLIGENCE-LOGIC.md §9.10. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const shopping: CategorySpec = {
  id: 'shopping',
  depth: 'basic',
  facts: CATEGORY_FACTS.shopping,
  metrics: [
    factMetric('planned_big_purchase', 'Planned big purchase', 'text', 'What you told us.'),
    factMetric('repair_mindset', 'Repair or replace', 'text', 'What you told us at sign-up.'),
    factMetric('online_deliveries', 'Online deliveries', 'band', 'What you told us at sign-up.'),
  ],
  rules: [
    {
      id: 'shopping.refurbished',
      whenNote: 'planned purchase is tech',
      when: (ctx) => ctx.str('planned_big_purchase') === 'TECH',
      finding: () => 'Refurbished tech could do the same job for less',
      drivers: ['planned_big_purchase'],
      actions: ['refurbished-tech'],
      options: [
        { key: 'see', label: 'See refurbished', actionId: 'refurbished-tech', effortMinutes: 15, approvalTier: 1, tradeOff: 'Check the warranty length.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'shopping.appliance_running_cost',
      whenNote: 'planned purchase is an appliance',
      when: (ctx) => ctx.str('planned_big_purchase') === 'APPLIANCE',
      finding: () => 'Compare running costs before you buy an appliance',
      drivers: ['planned_big_purchase'],
      actions: ['energy-label-compare'],
      options: [
        { key: 'compare', label: 'Compare running costs', actionId: 'energy-label-compare', effortMinutes: 15, approvalTier: 1, tradeOff: 'Efficient models can cost more up front.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'shopping.repair',
      whenNote: 'open to repairing',
      when: (ctx) => ['REPAIR_FIRST', 'MIXED'].includes(ctx.str('repair_mindset') ?? '') || ['YES', 'SHOW LOCAL'].includes(ctx.str('repair_first') ?? ''),
      finding: () => 'A local repair could save buying new',
      drivers: ['repair_mindset', 'repair_first'],
      actions: ['repair-not-replace'],
      options: [
        { key: 'find', label: 'Find a repair', actionId: 'repair-not-replace', effortMinutes: 15, approvalTier: 1, tradeOff: 'Not everything is worth repairing.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'shopping.student',
      whenNote: 'student',
      when: (ctx) => ctx.bool('student') === true,
      finding: () => 'Student discounts could apply to what you buy',
      drivers: ['student'],
      actions: ['student-totum-discount'],
      options: [
        { key: 'check', label: 'Check student discounts', actionId: 'student-totum-discount', effortMinutes: 10, approvalTier: 1, tradeOff: 'Some cards cost a small fee.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: [],
  context: [],
  agents: [],
}
