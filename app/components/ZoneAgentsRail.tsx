'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { eligibleAgents, readAgentContext, type ZoneAgent } from '@/lib/zoneAgents/registry'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'
import { BrandArrow } from '@/app/components/brand/BrandArrow'

/** Agent CTAs are stored in capitals (OPEN YOUR LIST); buttons read in sentence case. */
function agentCtaLabel(label: string): string {
  const v = String(label ?? '').trim()
  if (v !== v.toUpperCase()) return v
  const lower = v.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

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
            className="bento-card-groovy rock-bento-tile zone-rec-card zone-rec-card--large zone-agent-card zz-brand zzb-card"
            data-agent={agent.id}
            data-zone-surface="tip"
            onClick={() => trackFunnelEvent('cta_click', { page: ROUTES.ZONE, cta_label: `agent_${agent.id}` })}
          >
            <span className="card-top-label">{agent.label}</span>
            <h3 className="card-headline zone-rec-headline zzb-h4 m-0">{agent.headline}</h3>
            <p className="zone-rec-why m-0">{agent.why}</p>
            <span className="zone-rec-cta zzb-btn zzb-btn--sm zzb-btn--blue">
              {agentCtaLabel(agent.cta)} <BrandArrow />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
