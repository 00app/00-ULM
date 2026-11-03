/** Solar — docs/INTELLIGENCE-LOGIC.md §9.11. Owners only for installs; exports for anyone with panels. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

const hasPanels = (v: string | null) => v === 'YES'

export const solar: CategorySpec = {
  id: 'solar',
  depth: 'basic',
  facts: CATEGORY_FACTS.solar,
  metrics: [
    factMetric('irradiance', 'Sunlight a year (kWh per m²)', 'kwh_year', 'PVGIS for your location.'),
    {
      key: 'panels_battery',
      label: 'Panels and battery',
      unit: 'text',
      needs: ['has_panels'],
      computeNote: 'Your answers on panels and a battery.',
      compute: (ctx) => {
        const p = ctx.str('has_panels')
        if (!p) return null
        const b = ctx.str('has_battery')
        return { value: `${hasPanels(p) ? 'Panels' : 'No panels'}${b ? (b === 'YES' ? ', battery' : ', no battery') : ''}`, from: b ? ['has_panels', 'has_battery'] : ['has_panels'] }
      },
    },
    factMetric('export_tariff', 'Export tariff', 'text', 'What you told us.'),
    {
      key: 'kg_avoided',
      label: 'kg CO2e avoided a year',
      unit: 'kg_year',
      needs: ['pvgis_kwh_year'],
      referenceField: 'reference:grid_carbon_factor',
      computeNote: 'Likely kWh × grid factor from data/facts.json; neither is available yet.',
      compute: () => null,
    },
  ],
  rules: [
    {
      id: 'solar.export',
      whenNote: 'has panels and no export tariff',
      when: (ctx) => hasPanels(ctx.str('has_panels')) && ctx.str('export_tariff') === 'NONE',
      finding: () => 'You could be paid for the solar power you export',
      drivers: ['has_panels', 'export_tariff'],
      actions: ['solar-export-guarantee'],
      options: [
        { key: 'compare', label: 'Compare export tariffs', actionId: 'solar-export-guarantee', effortMinutes: 20, approvalTier: 2, tradeOff: 'Some need a smart meter first.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'solar.quotes',
      whenNote: 'owner, roof suitable, no panels',
      when: (ctx) =>
        ctx.str('tenure') === 'OWNER' &&
        ['SOUTH', 'EAST', 'WEST', 'MIXED'].includes(ctx.str('roof_orientation') ?? '') &&
        ['NONE', 'CHIMNEY'].includes(ctx.str('roof_shading') ?? '') &&
        !hasPanels(ctx.str('has_panels')),
      finding: () => 'Your roof could suit solar panels',
      drivers: ['tenure', 'roof_orientation', 'roof_shading', 'irradiance'],
      actions: ['solar-mcs-quotes'],
      options: [
        { key: 'quotes', label: 'Get MCS quotes', actionId: 'solar-mcs-quotes', effortMinutes: 30, approvalTier: 2, tradeOff: 'A big upfront cost that pays back over years.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: [],
  context: ['grant_window'],
  agents: [],
}
