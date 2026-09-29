'use client'

import { resolveSoloFocusDisplayProse } from '@/lib/soloFocusCopy'

export type SoloFocusProseStackProps = {
  headline: string
  insightSource: string
  journeyId: string
  moneyGbp: number
  carbonKg: number
  userPostcode?: string | null
  sourceDisplayName?: string | null
  auditHeaderLocality?: string | null
  locality?: string | null
  postcode?: string | null
  contentMode?: 'rock' | 'journey' | 'library'
  habitTitle?: string
}

export function SoloFocusProseStack({
  headline,
  insightSource,
  journeyId,
  moneyGbp,
  carbonKg,
  userPostcode,
  sourceDisplayName,
  auditHeaderLocality,
  locality,
  postcode,
  contentMode = 'journey',
  habitTitle,
}: SoloFocusProseStackProps) {
  const { lead, body } = resolveSoloFocusDisplayProse({
    headline,
    insightSource,
    journeyId,
    moneyGbp,
    carbonKg,
    userPostcode,
    sourceDisplayName,
    auditHeaderLocality,
    locality,
    postcode,
    contentMode,
    habitTitle,
  })

  if (!lead) return null

  return (
    <div className="solo-focus-true-tip-sections solo-focus-true-tip-sections--mother flex flex-col gap-0 w-full min-w-0">
      <h4
        className="solo-focus-architect-prose solo-focus-architect-lead solo-focus-copy-width solo-focus-content-text text-left m-0 text-display zz-h4 md:text-lg lg:text-xl"
        style={{ color: 'var(--journey-text)' }}
      >
        {lead}
      </h4>
      {/* The headline is the what; this lead line above is mostly the payoff. When the source
          prose had a real second paragraph (the why/how, grounded in the same architect_prose,
          not invented), surface it instead of dropping it. */}
      {body ? (
        <p
          className="solo-focus-architect-prose solo-focus-copy-width solo-focus-content-text text-left m-0 mt-2 zz-body"
          style={{ color: 'var(--journey-text)' }}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}
