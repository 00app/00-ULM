'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BrandArrow } from '@/app/components/brand/BrandArrow'
import { AgentRow, AgentShell } from '@/app/components/agents/AgentShell'
import { contractWhen, contractsFromAnswers, type ContractWatch } from '@/lib/zoneAgents/contracts/logic'
import { clientAnswers } from '@/lib/zone/soloFocusInsight'
import { onKnowledgeSynced } from '@/lib/knowledge/client'
import { librarySourceLine } from '@/lib/zone/recCardFromZone'
import { ROUTES } from '@/lib/routes'

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Contract watch: what ends when, from the dates you gave us, and where to compare. */
export function ContractsAgentClient() {
  const [contracts, setContracts] = useState<ContractWatch[] | null>(null)
  useEffect(() => {
    const load = () => setContracts(contractsFromAnswers(clientAnswers()))
    load()
    return onKnowledgeSynced(load)
  }, [])

  return (
    <AgentShell
      eyebrow="Contract watch"
      title="Your contracts"
      intro="Out of contract usually means paying more for the same thing. Dates are the ones you gave us, rounded to the band you picked."
      testId="agent-contracts"
    >
      {contracts === null ? null : contracts.length === 0 ? (
        <p className="zzb-body zzb-muted">
          We do not know any contract dates yet.{' '}
          <Link href={ROUTES.AGENT_KNOWLEDGE} className="zzb-link">
            Tell us a few
          </Link>
          .
        </p>
      ) : (
        <ul className="agent-brand__list">
          {contracts.map((c) => (
            <AgentRow
              key={c.questionId}
              title={c.label}
              meta={`${contractWhen(c)} · around ${longDate(c.endDate)}`}
              source={c.action ? librarySourceLine(c.action) : null}
            >
              {c.action && c.state !== 'later' ? (
                <a className="zzb-btn zzb-btn--sm zzb-btn--blue" href={c.action.url} target="_blank" rel="noopener noreferrer">
                  {c.state === 'ended' ? 'Compare now' : 'Compare deals'} <BrandArrow />
                </a>
              ) : (
                <span className="zzb-meta">Nothing to do yet</span>
              )}
            </AgentRow>
          ))}
        </ul>
      )}
    </AgentShell>
  )
}
