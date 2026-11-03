/** Money — docs/INTELLIGENCE-LOGIC.md §9.3. Entitlements first; debts are information only. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, listMonthlyTotal, OPTION_NOT_NOW } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const money: CategorySpec = {
  id: 'money',
  depth: 'deep',
  facts: CATEGORY_FACTS.money,
  metrics: [
    factMetric('monthly_outgoings', 'Outgoings a month', 'gbp_month', 'From connected bank data only (L4).'),
    {
      key: 'subscriptions_total',
      label: 'Subscriptions a month',
      unit: 'gbp_month',
      needs: ['subscriptions'],
      computeNote: 'Sum of subscription prices from your accounts or bank.',
      compute: (ctx) => listMonthlyTotal(ctx, 'subscriptions'),
    },
    factMetric('savings_rate', 'Your savings rate', 'band', 'The band you told us; compared with the Bank of England base rate.'),
    factMetric('council_tax_band', 'Council tax band', 'band', 'From the Valuation Office Agency.'),
  ],
  rules: [
    {
      id: 'money.benefits_first',
      whenNote: 'financial_pressure = TIGHT and benefits_check_done is not yes',
      when: (ctx) => ctx.str('financial_pressure') === 'TIGHT' && ctx.str('benefits_check_done') !== 'YES',
      finding: () => 'Check which benefits you can claim first',
      drivers: ['financial_pressure', 'benefits_check_done'],
      actions: ['benefits-entitlement-check'],
      options: [
        { key: 'check', label: 'Run the benefits check', actionId: 'benefits-entitlement-check', effortMinutes: 15, approvalTier: 1, tradeOff: 'You need rough figures for income and rent to hand.', prepares: 'link' },
        { key: 'done', label: 'I have done this already', effortMinutes: 0, approvalTier: 1, tradeOff: 'We will stop suggesting it.', prepares: 'none' },
      ],
    },
    {
      id: 'money.single_person_discount',
      whenNote: 'single_occupier',
      when: (ctx) => ctx.bool('single_occupier') === true,
      finding: () => 'You live alone, so 25% can come off your council tax',
      drivers: ['single_occupier', 'household'],
      actions: ['single-person-council-tax'],
      options: [
        { key: 'apply', label: 'Apply to your council', actionId: 'single-person-council-tax', effortMinutes: 10, approvalTier: 1, tradeOff: 'Tell the council if someone moves in later.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'money.savings_rate',
      whenNote: 'savings_rate below the base rate',
      when: (ctx) => ctx.str('savings_rate') === 'BELOW_BASE',
      finding: () => 'Your savings earn less than the base rate',
      drivers: ['savings_rate'],
      actions: ['easy-access-savings-compare'],
      options: [
        { key: 'compare', label: 'Compare easy-access accounts', actionId: 'easy-access-savings-compare', effortMinutes: 20, approvalTier: 2, tradeOff: 'Top rates often drop after a bonus period.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'money.marriage_allowance',
      whenNote: 'the library action’s own gates pass',
      when: (ctx) => ctx.eligible.has('marriage-allowance'),
      finding: () => 'You may be able to share a tax allowance with your partner',
      drivers: ['household'],
      actions: ['marriage-allowance'],
      options: [
        { key: 'check', label: 'Check on GOV.UK', actionId: 'marriage-allowance', effortMinutes: 10, approvalTier: 1, tradeOff: 'Only one of you can earn above the basic rate.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'money.pension_age',
      whenNote: 'age group RETIRED',
      when: (ctx) => ctx.str('age_group') === 'RETIRED',
      finding: () => 'There are pension-age entitlements you could check',
      drivers: ['age_group'],
      actions: ['pension-credit', 'attendance-allowance'],
      options: [
        { key: 'check', label: 'Check each one', actionId: 'pension-credit', effortMinutes: 20, approvalTier: 1, tradeOff: 'Each has its own claim form.', prepares: 'checklist' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: ['money_split', 'entitlements_checklist'],
  context: ['tax_year_end', 'price_cap_window'],
  agents: ['moving'],
}
