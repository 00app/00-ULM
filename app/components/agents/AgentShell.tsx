'use client'

import type { ReactNode } from 'react'
import ZoneBackToZoneLink from '@/app/components/ZoneBackToZoneLink'

/**
 * Brand shell for a Zone agent's results page: back to Zone, eyebrow, title, one-line intro.
 * Carries .zz-brand + .zz-brand-page so legacy classes inside read in the brand language.
 */
export function AgentShell({
  eyebrow,
  title,
  intro,
  testId,
  children,
}: {
  eyebrow: string
  title: string
  intro: ReactNode
  testId: string
  children: ReactNode
}) {
  return (
    <div className="agent-page agent-brand zz-brand zz-brand-page" data-testid={testId}>
      <ZoneBackToZoneLink />
      <p className="zzb-eyebrow">
        <span>{eyebrow}</span>
      </p>
      <h1 className="zz-page-title zzb-h2 zzb-ink">{title}</h1>
      <p className="zzb-lede zzb-muted agent-brand__intro">{intro}</p>
      {children}
    </div>
  )
}

/** One row: what, when/why, a source line, and the action. */
export function AgentRow({
  title,
  meta,
  source,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  source?: ReactNode
  children?: ReactNode
}) {
  return (
    <li className="agent-brand__row">
      <div className="agent-brand__row-body">
        <p className="zzb-h4 zzb-ink m-0">{title}</p>
        {meta ? <p className="zzb-body zzb-muted m-0">{meta}</p> : null}
        {source ? <p className="zzb-meta m-0">{source}</p> : null}
      </div>
      {children ? <div className="agent-brand__row-actions">{children}</div> : null}
    </li>
  )
}
