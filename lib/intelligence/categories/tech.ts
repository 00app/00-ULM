/** Tech — docs/INTELLIGENCE-LOGIC.md §9.1. Broadband, mobile, streaming, social tariffs. */

import { CATEGORY_FACTS } from '@/lib/household/factRegistry'
import { listMonthlyTotal, longDate, monthsSince, OPTION_NOT_NOW, plural, pounds, remindMe, soonestDateMetric, within } from '@/lib/intelligence/categories/shared'
import type { CategorySpec } from '@/lib/intelligence/categories/types'

export const tech: CategorySpec = {
  id: 'tech',
  depth: 'deep',
  facts: CATEGORY_FACTS.tech,
  metrics: [
    {
      key: 'comms_month',
      label: 'Broadband and mobile a month',
      unit: 'gbp_month',
      needs: ['broadband_monthly_price', 'mobile_monthly_price'],
      computeNote: 'Broadband plus mobile monthly prices, plus streaming when known.',
      compute: (ctx) => {
        const b = ctx.num('broadband_monthly_price')
        const m = ctx.num('mobile_monthly_price')
        if (b === null || m === null) return null
        const streaming = listMonthlyTotal(ctx, 'streaming_services')
        return {
          value: pounds(b + m) + (streaming ? Number(streaming.value) : 0),
          from: ['broadband_monthly_price', 'mobile_monthly_price', ...(streaming ? ['streaming_services'] : [])],
        }
      },
    },
    {
      key: 'months_out_of_contract',
      label: 'Months out of contract',
      unit: 'count',
      needs: ['broadband_contract_end'],
      computeNote: 'Today minus the broadband contract end date, in whole months; 0 while in contract.',
      compute: (ctx) => {
        const end = ctx.date('broadband_contract_end')
        if (!end) return null
        return { value: end < ctx.now.toISOString().slice(0, 10) ? monthsSince(end, ctx.now) : 0, from: ['broadband_contract_end'] }
      },
    },
    {
      key: 'streaming_total',
      label: 'Streaming a month',
      unit: 'gbp_month',
      needs: ['streaming_services'],
      computeNote: 'Sum of streaming service prices.',
      compute: (ctx) => listMonthlyTotal(ctx, 'streaming_services'),
    },
    soonestDateMetric('next_contract_end', 'Next contract end', ['broadband_contract_end', 'mobile_contract_end']),
  ],
  rules: [
    {
      id: 'tech.broadband_out_of_contract',
      whenNote: 'broadband_contract_end is before today',
      when: (ctx) => (ctx.days('broadband_contract_end') ?? 0) < 0,
      finding: (ctx) => {
        const months = monthsSince(ctx.date('broadband_contract_end') as string, ctx.now)
        return months > 0
          ? `Your broadband deal ended ${plural(months, 'month')} ago`
          : 'Your broadband deal has just ended'
      },
      drivers: ['broadband_contract_end', 'broadband_provider', 'broadband_monthly_price'],
      actions: ['out-of-contract-broadband'],
      deadlineFact: 'broadband_contract_end',
      options: [
        { key: 'switch', label: 'Switch provider', actionId: 'out-of-contract-broadband', effortMinutes: 20, approvalTier: 2, tradeOff: 'A new provider may need an engineer visit.', prepares: 'link' },
        { key: 'haggle', label: 'Haggle with your provider', actionId: 'out-of-contract-broadband', effortMinutes: 15, approvalTier: 1, tradeOff: 'What you save depends on what they offer.', prepares: 'script' },
        remindMe(30, 'Stay, remind me in 30 days'),
      ],
    },
    {
      id: 'tech.broadband_ending_soon',
      whenNote: 'broadband contract ends within 60 days',
      when: (ctx) => within(ctx.days('broadband_contract_end'), 0, 60),
      finding: (ctx) => `Your broadband deal ends on ${longDate(ctx.date('broadband_contract_end') as string)}`,
      drivers: ['broadband_contract_end', 'broadband_provider'],
      actions: ['out-of-contract-broadband'],
      deadlineFact: 'broadband_contract_end',
      options: [
        { key: 'compare', label: 'Compare deals now', actionId: 'out-of-contract-broadband', effortMinutes: 20, approvalTier: 2, tradeOff: 'Switching early can mean an exit fee; check your end date first.', prepares: 'link' },
        remindMe(14, 'Remind me 2 weeks before'),
      ],
    },
    {
      id: 'tech.social_tariff',
      whenNote: 'receives_means_tested_benefit = yes',
      when: (ctx) => ctx.str('receives_means_tested_benefit') === 'YES',
      finding: () => 'You could get broadband or mobile on a social tariff',
      drivers: ['receives_means_tested_benefit'],
      actions: ['social-broadband-tariff', 'mobile-social-tariff'],
      options: [
        { key: 'check', label: 'Check eligibility', actionId: 'social-broadband-tariff', effortMinutes: 10, approvalTier: 1, tradeOff: 'Social tariffs can be slower than your current package.', prepares: 'link' },
        OPTION_NOT_NOW,
      ],
    },
    {
      id: 'tech.sim_only',
      whenNote: 'mobile_handset_paid_off = yes',
      when: (ctx) => ctx.str('mobile_handset_paid_off') === 'YES',
      finding: () => 'Your phone is paid off, so a SIM-only plan could do',
      drivers: ['mobile_handset_paid_off', 'mobile_monthly_price'],
      actions: ['sim-only-switch'],
      options: [
        { key: 'switch', label: 'Switch to SIM-only', actionId: 'sim-only-switch', effortMinutes: 15, approvalTier: 2, tradeOff: 'You keep your phone but lose any handset upgrade.', prepares: 'link' },
        { key: 'haggle', label: 'Haggle with your network', effortMinutes: 15, approvalTier: 1, tradeOff: 'What you save depends on what they offer.', prepares: 'script' },
      ],
    },
    {
      id: 'tech.streaming_overlap',
      whenNote: '2 or more streaming services',
      when: (ctx) => (ctx.list('streaming_services')?.length ?? 0) >= 2,
      finding: (ctx) => `You pay for ${plural(ctx.list('streaming_services')?.length ?? 0, 'streaming service')}`,
      drivers: ['streaming_services'],
      actions: ['cancel-unused-subscriptions'],
      options: [
        { key: 'cancel', label: 'Cancel one', actionId: 'cancel-unused-subscriptions', effortMinutes: 10, approvalTier: 1, tradeOff: 'You lose that service’s shows until you rejoin.', prepares: 'checklist' },
        { key: 'rotate', label: 'Rotate one a month', effortMinutes: 5, approvalTier: 1, tradeOff: 'You watch one service at a time.', prepares: 'reminder' },
      ],
    },
  ],
  soloExtras: ['contract_timeline', 'haggle_script'],
  context: ['contract_deadline', 'follow_up_due'],
  agents: ['moving'],
}
