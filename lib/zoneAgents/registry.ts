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
import { ROUTES } from '@/lib/routes'

export type AgentContext = {
  now: Date
  /** Client-side checks read localStorage; keep isEligible cheap and side-effect free. */
  recentlyMoved: boolean
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
]

export function readAgentContext(now: Date = new Date()): AgentContext {
  return { now, recentlyMoved: isRecentlyMoved(now) }
}

export function eligibleAgents(ctx: AgentContext): ZoneAgent[] {
  return ZONE_AGENTS.filter((a) => a.isEligible(ctx))
}
