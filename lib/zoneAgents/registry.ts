/**
 * Zone agents — Zone is the place agents launch from. Each agent is switched on by something in
 * the user's own data (a life event, an answer), has its own intelligence, and gets one card on
 * Zone that opens its results page. Everything else on Zone is unchanged.
 *
 * To add an agent: add an entry here with an `isEligible` rule over AgentContext, a results route
 * under /agents/<id>, and its intelligence under lib/zoneAgents/<id>/.
 */

import { isRecentlyMoved } from '@/lib/zoneAgents/moving/movedState'
import { MOVING_TASKS } from '@/lib/zoneAgents/moving/knowledge'
import { contractsFromAnswers } from '@/lib/zoneAgents/contracts/logic'
import { isBenefitsAgentEligible } from '@/lib/zoneAgents/benefits/logic'
import { isKnowYourHomeEligible, overallKnowledge } from '@/lib/zoneAgents/knowledge/logic'
import { readGuestCompletions } from '@/lib/actions/actionCompletion'
import { toActionProfile } from '@/lib/household/queries'
import { clientAnswers, clientHousehold, isQuestionResting } from '@/lib/zone/soloFocusInsight'
import { ROUTES } from '@/lib/routes'

export type AgentContext = {
  now: Date
  /** Client-side checks read localStorage; keep isEligible cheap and side-effect free. */
  recentlyMoved: boolean
  /** Contracts we know end soon or have ended (from answered date questions). */
  contractsDue: number
  /** Money is tight / getting by and no benefits check this year. */
  benefitsDue: boolean
  /** Share of weighted household facts known, 0-1, and whether useful questions remain. */
  knowledgeScore: number
  knowledgeQuestionsLeft: boolean
}

export type ZoneAgent = {
  id: string
  /** Small label above the headline. */
  label: string
  headline: string
  why: string
  cta: string
  href: string
  isEligible: (ctx: AgentContext) => boolean
}

export const ZONE_AGENTS: readonly ZoneAgent[] = [
  {
    id: 'moving',
    label: 'Just moved',
    headline: 'Your moving-in list',
    why: `${MOVING_TASKS.length} things to sort after a move, from council tax to water and insurance, with the official place to do each one.`,
    cta: 'Open your list',
    href: ROUTES.AGENT_MOVING,
    isEligible: (ctx) => ctx.recentlyMoved,
  },
  {
    id: 'contracts',
    label: 'Contract watch',
    headline: 'A contract is ending',
    why: 'Out of contract usually means paying more for the same thing. Here is what ends when, and where to compare.',
    cta: 'See your contracts',
    href: ROUTES.AGENT_CONTRACTS,
    isEligible: (ctx) => ctx.contractsDue > 0,
  },
  {
    id: 'benefits',
    label: 'Benefits check',
    headline: 'Check what you can claim',
    why: 'Around 7 million UK households miss support they are entitled to. One list of the claims and social tariffs that fit you.',
    cta: 'See your claims',
    href: ROUTES.AGENT_BENEFITS,
    isEligible: (ctx) => ctx.benefitsDue,
  },
  {
    id: 'knowledge',
    label: 'Know your home',
    headline: 'A few quick answers',
    why: 'Each answer sharpens your savings. The questions that tell us the most, in one place, one tap each.',
    cta: 'Answer a few',
    href: ROUTES.AGENT_KNOWLEDGE,
    isEligible: (ctx) => ctx.knowledgeQuestionsLeft,
  },
]

export function readAgentContext(now: Date = new Date()): AgentContext {
  const h = clientHousehold(now)
  const answers = clientAnswers()
  const completions = readGuestCompletions()
  const resting = (q: string) => isQuestionResting(q, now.getTime())
  return {
    now,
    recentlyMoved: isRecentlyMoved(now),
    contractsDue: contractsFromAnswers(answers, now).filter((c) => c.state !== 'later').length,
    benefitsDue: h ? isBenefitsAgentEligible(toActionProfile(h), answers, completions) : false,
    knowledgeScore: h ? overallKnowledge(h).score : 0,
    knowledgeQuestionsLeft: h ? isKnowYourHomeEligible(h, resting) : false,
  }
}

export function eligibleAgents(ctx: AgentContext): ZoneAgent[] {
  return ZONE_AGENTS.filter((a) => a.isEligible(ctx))
}
