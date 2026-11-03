/** Utilities — docs/INTELLIGENCE-LOGIC.md §9.2. Energy tariff, fix end, support, meter readings. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, OPTION_NOT_NOW, plural, pounds, remindMe, within } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const utilities: CategorySpec = {
  id: 'utilities',
  depth: 'deep',
  facts: CATEGORY_FACTS.utilities,
  metrics: [
    {
      key: 'energy_month',
      label: 'Energy a month',
      unit: 'gbp_month',
      needs: ['energy_direct_debit'],
      computeNote: 'Your energy direct debit; otherwise the spend band you told us, shown as a band.',
      compute: (ctx) => {
        const dd = ctx.num('energy_direct_debit')
        if (dd !== null) return { value: pounds(dd), from: ['energy_direct_debit'] }
        return null
      },
    },
    factMetric('monthly_energy_band', 'Your spend band', 'band', 'The band you told us at sign-up.'),
    {
      key: 'fix_end',
      label: 'Fixed deal ends',
      unit: 'date',
      needs: ['fix_end_date'],
      computeNote: 'Your fixed tariff end date.',
      compute: (ctx) => {
        const d = ctx.date('fix_end_date')
        return d ? { value: d, from: ['fix_end_date'] } : null
      },
    },
    {
      key: 'price_cap_typical',
      label: 'Price cap typical bill',
      unit: 'gbp_year',
      needs: [],
      referenceField: 'reference:price_cap_typical',
      computeNote: 'Ofgem typical annual bill from data/facts.json (front-door Prompt 3).',
      // data/facts.json does not exist yet; this stays "Not known yet" until it does.
      compute: () => null,
    },
  ],
  rules: [
    {
      id: 'utilities.fix_ending',
      whenNote: 'fix ends within 49 days',
      when: (ctx) => within(ctx.days('fix_end_date'), 0, 49),
      finding: (ctx) => {
        const d = ctx.days('fix_end_date') as number
        return d === 0 ? 'Your fixed energy deal ends today' : `Your fixed energy deal ends in ${plural(d, 'day')}`
      },
      drivers: ['fix_end_date', 'supplier', 'energy_direct_debit'],
      actions: ['energy-tariff-compare'],
      deadlineFact: 'fix_end_date',
      options: [
        { key: 'compare', label: 'Compare fixed deals now', actionId: 'energy-tariff-compare', effortMinutes: 15, approvalTier: 2, tradeOff: 'A new fix can carry exit fees if prices fall.', prepares: 'link' },
        remindMe(14),
      ],
    },
    {
      id: 'utilities.variable_vs_fix',
      whenNote: 'tariff_type = variable',
      when: (ctx) => ctx.str('tariff_type') === 'VARIABLE',
      finding: () => 'You are on a variable energy tariff',
      drivers: ['tariff_type', 'supplier'],
      actions: ['energy-tariff-compare'],
      options: [
        { key: 'compare', label: 'Compare fixes', actionId: 'energy-tariff-compare', effortMinutes: 15, approvalTier: 2, tradeOff: 'A fix protects you from rises but not from falls.', prepares: 'link' },
        { key: 'stay', label: 'Stay on the cap', effortMinutes: 0, approvalTier: 0, tradeOff: 'Your price moves with each quarterly cap.', prepares: 'none' },
      ],
    },
    {
      id: 'utilities.time_of_use',
      whenNote: 'has_ev or has_heat_pump',
      when: (ctx) => ctx.bool('has_ev') === true || ctx.bool('has_heat_pump') === true,
      finding: () => 'A time-of-use tariff could suit how you use power',
      drivers: ['has_ev', 'has_heat_pump'],
      actions: ['time-of-use-tariff'],
      options: [
        { key: 'compare', label: 'Compare time-of-use tariffs', actionId: 'time-of-use-tariff', effortMinutes: 20, approvalTier: 2, tradeOff: 'Peak-time power usually costs more.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'utilities.in_credit',
      whenNote: 'account_credit_months 2 or more',
      when: (ctx) => ctx.str('account_credit_months') === '2 OR MORE',
      finding: () => 'Your energy account is well in credit',
      drivers: ['account_credit_months', 'energy_direct_debit'],
      actions: ['energy-credit-refund'],
      options: [
        { key: 'refund', label: 'Ask for a refund', actionId: 'energy-credit-refund', effortMinutes: 10, approvalTier: 1, tradeOff: 'Leave some credit if winter bills are still to come.', prepares: 'letter' },
        { key: 'lower', label: 'Lower your direct debit', effortMinutes: 10, approvalTier: 1, tradeOff: 'Too low and you build up a debt instead.', prepares: 'script' },
      ],
    },
    {
      id: 'utilities.support',
      whenNote: 'financial_pressure = TIGHT',
      when: (ctx) => ctx.str('financial_pressure') === 'TIGHT',
      finding: () => 'There is help with energy bills you could check',
      drivers: ['financial_pressure'],
      actions: ['warm-home-discount', 'priority-services-register', 'energy-trust-debt-grant'],
      options: [
        { key: 'check', label: 'Check each scheme', actionId: 'warm-home-discount', effortMinutes: 20, approvalTier: 1, tradeOff: 'Each scheme has its own rules and dates.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'utilities.readings',
      whenNote: 'no smart meter',
      when: (ctx) => ctx.str('smart_meter') === 'NO',
      finding: () => 'Without a smart meter, regular readings keep bills accurate',
      drivers: ['smart_meter'],
      actions: ['submit-meter-reading', 'smart-meter-install'],
      options: [
        { key: 'reading', label: 'Submit a reading', actionId: 'submit-meter-reading', effortMinutes: 5, approvalTier: 1, tradeOff: 'You need to do it again each month or quarter.', prepares: 'reminder' },
        { key: 'smart', label: 'Book a smart meter', actionId: 'smart-meter-install', effortMinutes: 10, approvalTier: 1, tradeOff: 'Someone needs to be in for the install.', prepares: 'link' },
      ],
    },
  ],
  soloExtras: ['rate_vs_cap', 'price_cap_calendar'],
  context: ['price_cap_window', 'electricity_vat_window', 'heating_season', 'grid_carbon_now'],
  agents: ['moving'],
}
