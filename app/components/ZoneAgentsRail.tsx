'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { eligibleAgents, readAgentContext, type ZoneAgent } from '@/lib/zoneAgents/registry'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'

/**
 * Zone agents — one card per agent the user's own data switches on (see lib/zoneAgents/registry).
 * Renders nothing when no agent applies, so Zone is unchanged for everyone else. Eligibility reads
 * localStorage, so it is resolved after mount (no hydration mismatch).
 */
export function ZoneAgentsRail() {
  const [agents, setAgents] = useState<ZoneAgent[]>([])
  useEffect(() => {
    setAgents(eligibleAgents(readAgentContext()))
  }, [])
  if (agents.length === 0) return null

  return (
    <section className="zone-rail zone-agents" data-testid="zone-agents" aria-labelledby="zone-agents-title">
      <div className="zone-rail-head">
        <h3 id="zone-agents-title" className="zone-rail-title m-0">
          For you right now
        </h3>
      </div>
      <div className="zone-agents-list">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={agent.href}
            className="bento-card-groovy rock-bento-tile zone-rec-card zone-rec-card--large zone-agent-card"
            data-agent={agent.id}
            data-zone-surface="tip"
            style={{ borderRadius: 60, boxShadow: 'none' }}
            onClick={() => trackFunnelEvent('cta_click', { page: ROUTES.ZONE, cta_label: `agent_${agent.id}` })}
          >
            <span className="card-top-label">{agent.label}</span>
            <h3 className="card-headline zone-rec-headline m-0">{agent.headline}</h3>
            <p className="zone-rec-why m-0">{agent.why}</p>
            <span className="zone-rec-cta">{agent.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
