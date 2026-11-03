/**
 * Carbon — docs/INTELLIGENCE-LOGIC.md §9.13. No facts of its own: it rolls up the other
 * categories. Its figures need per-category kg factors and live grid data (Z8), so until then
 * every metric is "Not known yet" and the category shows Coming soon.
 */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

const pending = (key: string, label: string, referenceField: string, computeNote: string) => ({
  key,
  label,
  unit: 'kg_year' as const,
  needs: [],
  referenceField,
  computeNote,
  compute: () => null,
})

export const carbon: CategorySpec = {
  id: 'carbon',
  depth: 'basic',
  facts: CATEGORY_FACTS.carbon,
  metrics: [
    pending('household_kg', 'Household kg CO2e a year', 'reference:category_kg_factors', 'Sum of category kg where a published factor exists.'),
    pending('biggest_lever', 'Biggest lever', 'reference:ranked_actions', 'Category with the largest kg range from ranked actions (Z8).'),
    pending('grid_now', 'Grid carbon now', 'reference:neso_grid_intensity', 'NESO live intensity (Z8 context).'),
    pending('kg_cut', 'kg cut so far', 'reference:realised_tasks', 'From realised tasks (Z11).'),
  ],
  rules: [],
  soloExtras: [],
  context: ['grid_carbon_now'],
  agents: [],
}
