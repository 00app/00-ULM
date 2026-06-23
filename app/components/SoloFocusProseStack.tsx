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
  contentMode?: 'rock' | 'journey'
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
  const { lead } = resolveSoloFocusDisplayProse({
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
        className="solo-focus-architect-prose solo-focus-architect-lead solo-focus-copy-width solo-focus-content-text text-left m-0 text-marvin zz-h4 md:text-lg lg:text-xl"
        style={{ color: 'var(--journey-text)' }}
      >
        {lead}
      </h4>
    </div>
  )
}
