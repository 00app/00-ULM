/** Home — docs/INTELLIGENCE-LOGIC.md §9.5. Tenure decides the options: owners retrofit, renters ask. */

import { ZONE_ACTIONS } from '@/lib/actions/actionLibrary'
import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, inHeatingSeason, longDate, OPTION_NOT_NOW, within } from '@/lib/intelligence/categories/shared'
import type { CategorySpec, SpecContext } from '@/lib/intelligence/categories/types'

const LOW_BANDS = ['D', 'E', 'F', 'G']
const band = (ctx: SpecContext) => ctx.str('epc_band')

export const home: CategorySpec = {
  id: 'home',
  depth: 'deep',
  facts: CATEGORY_FACTS.home,
  metrics: [
    {
      key: 'epc_now_potential',
      label: 'EPC band now and possible',
      unit: 'band',
      needs: ['epc_band'],
      computeNote: 'Current EPC band, and the potential band when the certificate gives one.',
      compute: (ctx) => {
        const now = band(ctx)
        if (!now) return null
        const potential = ctx.str('epc_potential')
        return { value: potential ? `${now} now, ${potential} possible` : now, from: potential ? ['epc_band', 'epc_potential'] : ['epc_band'] }
      },
    },
    factMetric('main_heating', 'Main heating', 'text', 'From your EPC.'),
    {
      key: 'grants_count',
      label: 'Grants you may qualify for',
      unit: 'count',
      needs: ['tenure'],
      computeNote: 'Home CLAIM actions in the action library that pass your eligibility gates.',
      compute: (ctx) => {
        if (!ctx.str('tenure')) return null
        const grants = ZONE_ACTIONS.filter((a) => a.bucket === 'home' && a.verb === 'CLAIM' && ctx.eligible.has(a.id))
        const asOf = grants.map((a) => a.verifiedOn).sort()[0] ?? ZONE_ACTIONS.map((a) => a.verifiedOn).sort().at(-1) ?? ''
        return {
          value: grants.length,
          from: ['tenure'],
          source: { kind: 'derived', name: 'Zero Zero action library, each scheme cited', url: null, asOf },
        }
      },
    },
    {
      key: 'home_insurance_renewal',
      label: 'Home insurance renews',
      unit: 'date',
      needs: ['home_insurance_renewal'],
      computeNote: 'Your home insurance renewal date.',
      compute: (ctx) => {
        const d = ctx.date('home_insurance_renewal')
        return d ? { value: d, from: ['home_insurance_renewal'] } : null
      },
    },
  ],
  rules: [
    {
      id: 'home.retrofit_grant',
      whenNote: 'tenure OWNER and EPC D to G',
      when: (ctx) => ctx.str('tenure') === 'OWNER' && LOW_BANDS.includes(band(ctx) ?? ''),
      finding: (ctx) => `Your home is EPC ${band(ctx)}, so grants could help you improve it`,
      drivers: ['tenure', 'epc_band', 'main_heating', 'walls', 'loft'],
      actions: ['boiler-upgrade-scheme', 'loft-insulation'],
      options: [
        { key: 'grants', label: 'Check the grants', actionId: 'boiler-upgrade-scheme', effortMinutes: 20, approvalTier: 2, tradeOff: 'Grants cover part of the cost, not all of it.', prepares: 'checklist' },
        { key: 'assessment', label: 'Get a retrofit assessment first', effortMinutes: 30, approvalTier: 2, tradeOff: 'Takes longer, but tells you which measure to do first.', prepares: 'link' },
      ],
    },
    {
      id: 'home.renter_standard',
      whenNote: 'tenure RENTER and EPC below C',
      when: (ctx) => ctx.str('tenure') === 'RENTER' && LOW_BANDS.includes(band(ctx) ?? ''),
      finding: (ctx) => `Your rented home is EPC ${band(ctx)}; your landlord may need to improve it`,
      drivers: ['tenure', 'epc_band'],
      actions: ['landlord-epc-letter', 'draught-proofing-renter-safe'],
      options: [
        { key: 'letter', label: 'Write to your landlord', actionId: 'landlord-epc-letter', effortMinutes: 15, approvalTier: 2, tradeOff: 'It may take months, and you need to keep a copy.', prepares: 'letter' },
        { key: 'renter_safe', label: 'Renter-safe fixes', actionId: 'draught-proofing-renter-safe', effortMinutes: 30, approvalTier: 1, tradeOff: 'Small gains, but you can take them with you.', prepares: 'checklist' },
      ],
    },
    {
      id: 'home.quick_wins',
      whenNote: 'heating season, October to March',
      when: (ctx) => inHeatingSeason(ctx.month),
      finding: () => 'Small heating changes that cost nothing this winter',
      drivers: ['main_heating', 'power_type'],
      actions: ['heating-controls-timing', 'boiler-flow-temperature', 'bleed-radiators', 'radiator-reflector-panels', 'draught-proofing-renter-safe', 'led-bulb-swap'],
      options: [
        { key: 'pick', label: 'Pick one to try', actionId: 'boiler-flow-temperature', effortMinutes: 15, approvalTier: 1, tradeOff: 'Each is small; together they add up.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'home.flood',
      whenNote: 'flood risk medium or higher',
      when: (ctx) => ['MEDIUM', 'HIGH', 'VERY_HIGH'].includes(ctx.str('flood_risk') ?? ''),
      finding: () => 'Your area has flood alerts, so check your home cover',
      drivers: ['flood_risk'],
      actions: ['flood-re-insurance-check'],
      options: [
        { key: 'check', label: 'Check your cover', actionId: 'flood-re-insurance-check', effortMinutes: 15, approvalTier: 1, tradeOff: 'Alerts are not a survey of your home.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'home.insurance_renewal',
      whenNote: 'home insurance renews within 30 days',
      when: (ctx) => within(ctx.days('home_insurance_renewal'), 0, 30),
      finding: (ctx) => `Your home insurance renews on ${longDate(ctx.date('home_insurance_renewal') as string)}`,
      drivers: ['home_insurance_renewal'],
      actions: ['home-insurance-renewal-check'],
      deadlineFact: 'home_insurance_renewal',
      options: [
        { key: 'compare', label: 'Compare quotes', actionId: 'home-insurance-renewal-check', effortMinutes: 20, approvalTier: 2, tradeOff: 'Check the cover matches, not just the price.', prepares: 'link' },
        { key: 'haggle', label: 'Ask your insurer for a better price', effortMinutes: 15, approvalTier: 1, tradeOff: 'They may say no; your cover carries on.', prepares: 'script' },
      ],
    },
  ],
  soloExtras: ['epc_ladder', 'grant_checklist'],
  context: ['heating_season', 'grant_window', 'contract_deadline'],
  agents: ['moving'],
}
