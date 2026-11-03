/**
 * Lifestyle — docs/INTELLIGENCE-LOGIC.md §9.4. Value per use only: never "too much", "waste",
 * body or health words. No kg (no published factor).
 */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { factMetric, longDate, OPTION_NOT_NOW, pounds, within } from '@/lib/intelligence/categories/shared'
import type { CategorySpec, SpecContext } from '@/lib/intelligence/categories/types'

/** Visits a month from the account (number) or the loop answer band. Unknown stays null. */
function lowestUse(ctx: SpecContext): { usesPerMonth: number; name: string; monthlyPence: number | null } | null {
  const items = ctx.list('membership_uses_per_month') ?? []
  const priced = new Map((ctx.list('memberships') ?? []).map((m) => [String(m.name), typeof m.monthlyPence === 'number' ? m.monthlyPence : null]))
  const known = items
    .filter((i) => typeof i.usesPerMonth === 'number')
    .map((i) => ({ usesPerMonth: i.usesPerMonth as number, name: String(i.name), monthlyPence: priced.get(String(i.name)) ?? null }))
    .sort((a, b) => a.usesPerMonth - b.usesPerMonth)
  return known[0] ?? null
}

/** The loop answer for visits, when there is no account figure. */
const visitsBand = (ctx: SpecContext) => ctx.str('membership_uses_per_month')

export const lifestyle: CategorySpec = {
  id: 'lifestyle',
  depth: 'deep',
  facts: CATEGORY_FACTS.lifestyle,
  metrics: [
    {
      key: 'memberships_month',
      label: 'Memberships a month',
      unit: 'gbp_month',
      needs: ['memberships'],
      computeNote: 'Sum of membership prices from your accounts.',
      compute: (ctx) => {
        const items = ctx.list('memberships')
        if (!items || items.length === 0 || items.some((i) => typeof i.monthlyPence !== 'number')) return null
        return { value: pounds(items.reduce((s, i) => s + (i.monthlyPence as number), 0)), from: ['memberships'] }
      },
    },
    {
      key: 'cost_per_visit',
      label: 'Cost per visit',
      unit: 'gbp',
      needs: ['membership_uses_per_month', 'memberships'],
      computeNote: 'Monthly price ÷ visits a month, for your least-used membership. 0 visits shows the full monthly price.',
      compute: (ctx) => {
        const low = lowestUse(ctx)
        if (!low || low.monthlyPence === null) return null
        return { value: pounds(low.monthlyPence / Math.max(1, low.usesPerMonth)), from: ['memberships', 'membership_uses_per_month'] }
      },
    },
    factMetric('eating_out_per_week', 'Eating out or ordering in', 'band', 'The band you told us.'),
    {
      key: 'pet_insurance_renewal',
      label: 'Pet insurance renews',
      unit: 'date',
      needs: ['pet_insurance_renewal'],
      computeNote: 'Your pet insurance renewal date.',
      compute: (ctx) => {
        const d = ctx.date('pet_insurance_renewal')
        return d ? { value: d, from: ['pet_insurance_renewal'] } : null
      },
    },
  ],
  rules: [
    {
      id: 'lifestyle.low_use_membership',
      // The doc's threshold (cost per visit above a level in data/facts.json) has no sourced value
      // yet, so this fires on use alone: once a month or less.
      whenNote: 'a membership used once a month or less (cost-per-visit threshold pending a source)',
      when: (ctx) => {
        const low = lowestUse(ctx)
        if (low) return low.usesPerMonth <= 1
        return visitsBand(ctx) === 'NONE OR ONCE'
      },
      finding: (ctx) => {
        const low = lowestUse(ctx)
        if (low && low.monthlyPence !== null) {
          const price = `£${pounds(low.monthlyPence).toFixed(2)}`
          return low.usesPerMonth === 0
            ? `You pay ${price} a month for ${low.name} and rarely go`
            : `Each visit to ${low.name} costs you £${pounds(low.monthlyPence / low.usesPerMonth).toFixed(2)}`
        }
        return 'You use a membership once a month or less'
      },
      drivers: ['memberships', 'membership_uses_per_month'],
      actions: ['membership-pause-or-downgrade'],
      options: [
        { key: 'pause', label: 'Ask to pause it', actionId: 'membership-pause-or-downgrade', effortMinutes: 10, approvalTier: 1, tradeOff: 'Some places charge a small fee to freeze.', prepares: 'script' },
        { key: 'off_peak', label: 'Move to off-peak', actionId: 'membership-pause-or-downgrade', effortMinutes: 10, approvalTier: 1, tradeOff: 'You can only go at quieter times.', prepares: 'script' },
        { key: 'downgrade', label: 'Drop to a cheaper plan', actionId: 'membership-pause-or-downgrade', effortMinutes: 10, approvalTier: 1, tradeOff: 'Check the notice period and any exit fee first.', prepares: 'script' },
      ],
    },
    {
      id: 'lifestyle.takeaway_subscription',
      whenNote: 'takeaway app subscription and rarely ordering',
      when: (ctx) => ctx.bool('takeaway_app_subscription') === true && ctx.str('eating_out_per_week') === 'RARELY',
      finding: () => 'You pay for a takeaway app subscription but rarely order',
      drivers: ['takeaway_app_subscription', 'eating_out_per_week'],
      actions: ['takeaway-subscription-check'],
      options: [
        { key: 'cancel', label: 'Cancel it', actionId: 'takeaway-subscription-check', effortMinutes: 5, approvalTier: 1, tradeOff: 'You pay delivery fees again on the odd order.', prepares: 'checklist' },
        { key: 'keep', label: 'Keep it', effortMinutes: 0, approvalTier: 0, tradeOff: 'Worth it only if you order often enough.', prepares: 'none' },
      ],
    },
    {
      id: 'lifestyle.pet_renewal',
      whenNote: 'pet insurance renews within 30 days',
      when: (ctx) => within(ctx.days('pet_insurance_renewal'), 0, 30),
      finding: (ctx) => `Your pet insurance renews on ${longDate(ctx.date('pet_insurance_renewal') as string)}`,
      drivers: ['pet_insurance_renewal', 'pet_owner'],
      actions: ['pet-insurance-renewal-check'],
      deadlineFact: 'pet_insurance_renewal',
      options: [
        { key: 'compare', label: 'Compare quotes', actionId: 'pet-insurance-renewal-check', effortMinutes: 20, approvalTier: 2, tradeOff: 'A new insurer usually will not cover conditions your pet already has.', prepares: 'link' },
        { key: 'ask', label: 'Ask for a better price', effortMinutes: 15, approvalTier: 1, tradeOff: 'They may say no; you keep your cover either way.', prepares: 'script' },
      ],
    },
    {
      id: 'lifestyle.concessions',
      whenNote: 'leisure_concession_eligible',
      when: (ctx) => ctx.bool('leisure_concession_eligible') === true,
      finding: () => 'Your council may offer a cheaper leisure pass',
      drivers: ['leisure_concession_eligible', 'age_group', 'employment_status', 'financial_pressure'],
      actions: ['leisure-concession'],
      options: [
        { key: 'check', label: 'Check your council’s scheme', actionId: 'leisure-concession', effortMinutes: 10, approvalTier: 1, tradeOff: 'Each council sets its own rules and proof.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
  ],
  soloExtras: ['cost_per_visit_bars'],
  context: ['contract_deadline'],
  agents: [],
}
