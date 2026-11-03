/** Waste — docs/INTELLIGENCE-LOGIC.md §9.12. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const waste: CategorySpec = {
  id: 'waste',
  depth: 'basic',
  facts: CATEGORY_FACTS.waste,
  metrics: [
    factMetric('council_collections', 'Collection days', 'text', 'From your council (Defra).'),
    factMetric('garden_waste_subscription', 'Garden waste collection', 'text', 'What you told us.'),
    factMetric('food_waste_collection', 'Food caddy', 'text', 'What you told us at sign-up.'),
  ],
  rules: [
    {
      id: 'waste.reuse',
      whenNote: 'always',
      when: () => true,
      finding: () => 'Give away or pick up things for free near you',
      drivers: ['repair_mindset'],
      actions: ['freegle-local-reuse'],
      options: [
        { key: 'find', label: 'Find local reuse', actionId: 'freegle-local-reuse', effortMinutes: 10, approvalTier: 1, tradeOff: 'You arrange pick-ups yourself.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'waste.compost',
      whenNote: 'pays for garden waste and open to composting',
      when: (ctx) => ctx.str('garden_waste_subscription') === 'YES' && ['YES', 'TRY IT'].includes(ctx.str('compost_open') ?? ''),
      finding: () => 'Composting at home could replace your garden waste collection',
      drivers: ['garden_waste_subscription', 'compost_open'],
      actions: ['home-compost'],
      options: [
        { key: 'start', label: 'Compost at home', actionId: 'home-compost', effortMinutes: 30, approvalTier: 1, tradeOff: 'Needs space and a few minutes a week.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'waste.food_caddy',
      whenNote: 'food waste collection not used',
      when: (ctx) => ctx.str('food_waste_collection') === 'NO',
      finding: () => 'Your council may collect food waste if you ask for a caddy',
      drivers: ['food_waste_collection'],
      actions: ['food-caddy-request'],
      options: [
        { key: 'request', label: 'Request a caddy', actionId: 'food-caddy-request', effortMinutes: 10, approvalTier: 1, tradeOff: 'Not every council collects food waste yet.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: [],
  context: [],
  agents: [],
}
