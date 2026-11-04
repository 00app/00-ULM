'use client'

import { useEffect, useState } from 'react'
import { BrandArrow } from '@/app/components/brand/BrandArrow'
import { AgentRow, AgentShell } from '@/app/components/agents/AgentShell'
import type { ZoneAction } from '@/lib/actions/actionTypes'
import { markGuestCompleted, postActionedCard, readGuestCompletions } from '@/lib/actions/actionCompletion'
import { benefitsClaims } from '@/lib/zoneAgents/benefits/logic'
import { toActionProfile } from '@/lib/household/queries'
import { clientHousehold } from '@/lib/zone/soloFocusInsight'
import { librarySourceLine, typicalSavingForLibraryCard } from '@/lib/zone/recCardFromZone'
import { formatTypicalSaving } from '@/lib/zone/recCard'

/** Benefits check: every claim and social tariff that fits this household, benefits check first. */
export function BenefitsAgentClient() {
  const [claims, setClaims] = useState<ZoneAction[] | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const h = clientHousehold()
    setClaims(h ? benefitsClaims(toActionProfile(h), readGuestCompletions()) : [])
  }, [])

  return (
    <AgentShell
      eyebrow="Benefits check"
      title="What you can claim"
      intro="Start with the free benefits check: it tells you what you are owed in about ten minutes. The rest are claims and social tariffs that fit what you told us."
      testId="agent-benefits"
    >
      {claims === null ? null : claims.length === 0 ? (
        <p className="zzb-body zzb-muted">Nothing new to claim right now. We will show new ones here as your answers change.</p>
      ) : (
        <ul className="agent-brand__list">
          {claims.map((a) => {
            const typical = typicalSavingForLibraryCard(`journey-${a.id}`)
            const worth = typical ? formatTypicalSaving(typical) : null
            const isDone = Boolean(done[a.id])
            return (
              <AgentRow
                key={a.id}
                title={a.action}
                meta={worth ? `${worth.before}${worth.figure}${worth.after}` : a.detail.split('. ')[0]}
                source={librarySourceLine(a)}
              >
                <a className="zzb-btn zzb-btn--sm zzb-btn--blue" href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.verb === 'SWITCH' ? 'Check the tariff' : 'Check and claim'} <BrandArrow />
                </a>
                <button
                  type="button"
                  className="zzb-link"
                  aria-pressed={isDone}
                  disabled={isDone}
                  onClick={() => {
                    markGuestCompleted(a.id)
                    void postActionedCard(a.id)
                    setDone((m) => ({ ...m, [a.id]: true }))
                  }}
                >
                  {isDone ? 'Done' : 'Done it'}
                </button>
              </AgentRow>
            )
          })}
        </ul>
      )}
    </AgentShell>
  )
}
