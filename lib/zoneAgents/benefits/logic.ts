/**
 * Benefits check agent — when money is tight or getting by and no benefits check has been done
 * this year, gather every claim and social tariff this household can make in one list.
 *
 * Pure. Which claims show is decided by the action library's own hard filters (eligibleActions:
 * gates, excludes, requires, cost, season, recurrence-aware completions), so the agent can never
 * suggest something the Zone itself would hide. The benefits calculator always leads.
 */

import type { ActionCompletion, ActionProfile, ZoneAction } from '@/lib/actions/actionTypes'
import { normalizeFinancialPressure } from '@/lib/actions/actionTypes'
import { eligibleActions } from '@/lib/actions/selectActions'

export const BENEFITS_LEAD_ACTION = 'benefits-entitlement-check'
const MAX_CLAIMS = 8

/** Social tariffs are SWITCH actions but belong with the claims for someone on a low income. */
const SOCIAL_TARIFFS = new Set(['social-broadband-tariff', 'mobile-social-tariff', 'water-social-tariff'])

export function isBenefitsAgentEligible(
  profile: ActionProfile,
  answers: Record<string, string>,
  completions: ActionCompletion[]
): boolean {
  const pressure = normalizeFinancialPressure(profile.financial)
  if (pressure !== 'TIGHT' && pressure !== 'GETTING_BY') return false
  if (answers.money_benefits_checked === 'YES') return false
  return !completions.some((c) => c.actionId === BENEFITS_LEAD_ACTION)
}

export function benefitsClaims(
  profile: ActionProfile,
  completions: ActionCompletion[],
  now: Date = new Date()
): ZoneAction[] {
  const eligible = eligibleActions(profile, { completions, now, month: now.getMonth() + 1 })
  const claims = eligible.filter((a) => a.verb === 'CLAIM' || SOCIAL_TARIFFS.has(a.id))
  const lead = claims.find((a) => a.id === BENEFITS_LEAD_ACTION)
  const rest = claims.filter((a) => a.id !== BENEFITS_LEAD_ACTION)
  return [...(lead ? [lead] : []), ...rest].slice(0, MAX_CLAIMS)
}
