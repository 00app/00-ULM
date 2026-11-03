/** Holidays — docs/INTELLIGENCE-LOGIC.md §9.8. kg only from published factors (none wired yet). */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const holidays: CategorySpec = {
  id: 'holidays',
  depth: 'basic',
  facts: CATEGORY_FACTS.holidays,
  metrics: [
    factMetric('trips_per_year', 'Trips a year', 'band', 'What you told us.'),
    factMetric('annual_flights', 'Flights a year', 'band', 'What you told us at sign-up.'),
    factMetric('travel_insurance', 'Travel insurance', 'text', 'From your accounts or what you told us.'),
    {
      key: 'travel_kg',
      label: 'Travel kg CO2e a year',
      unit: 'kg_year',
      needs: ['annual_flights'],
      referenceField: 'reference:defra_aviation_factor',
      computeNote: 'Flights × DESNZ aviation factor; the factor is not in data/facts.json yet.',
      compute: () => null,
    },
  ],
  rules: [
    {
      id: 'holidays.annual_cover',
      whenNote: '2 or more trips and single-trip or no insurance',
      when: (ctx) => ['ONE_TWO', 'THREE_PLUS'].includes(ctx.str('annual_flights') ?? '') && ['SINGLE', 'NONE'].includes(ctx.str('travel_insurance') ?? ''),
      finding: () => 'Annual travel cover can cost less than buying it per trip',
      drivers: ['annual_flights', 'travel_insurance'],
      actions: ['annual-travel-insurance'],
      options: [
        { key: 'compare', label: 'Compare annual cover', actionId: 'annual-travel-insurance', effortMinutes: 20, approvalTier: 2, tradeOff: 'Annual policies limit the length of each trip.', prepares: 'link' },
        { key: 'stay', label: 'Keep buying per trip', effortMinutes: 0, approvalTier: 0, tradeOff: 'Fine if you travel once a year or less.', prepares: 'none' },
      ],
    },
    {
      id: 'holidays.rail_option',
      whenNote: 'short-haul flights and open to rail',
      when: (ctx) => ctx.str('flight_duration') === 'SHORT' && (ctx.str('rail_open') ?? '').startsWith('YES'),
      finding: () => 'Your short trips may work by train',
      drivers: ['flight_duration', 'rail_open'],
      actions: ['rail-instead-of-short-flight'],
      options: [
        { key: 'routes', label: 'See rail routes', actionId: 'rail-instead-of-short-flight', effortMinutes: 15, approvalTier: 1, tradeOff: 'Usually takes longer door to door.', prepares: 'link' },
        { key: 'stay', label: 'Keep flying', effortMinutes: 0, approvalTier: 0, tradeOff: 'Higher kg per trip.', prepares: 'none' },
      ],
    },
  ],
  soloExtras: ['trip_planner_prompt'],
  context: ['booking_season'],
  agents: [],
}
