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
  /** Discovery inject cards — lead only (no Roboto body block). */
  leadOnly?: boolean
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
  leadOnly = false,
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
  })

  if (!lead && !body) return null

  const proseStyle = { color: 'var(--journey-text)' as const }

  return (
    <div className="solo-focus-true-tip-sections solo-focus-true-tip-sections--mother flex flex-col gap-0 w-full min-w-0">
      {lead ? (
        <h4
          className="solo-focus-architect-prose solo-focus-architect-lead solo-focus-copy-width solo-focus-content-text text-left m-0 text-marvin zz-h4 md:text-lg lg:text-xl"
          style={proseStyle}
        >
          {lead}
        </h4>
      ) : null}
      {body && !leadOnly ? (
        <p
          className="solo-focus-architect-prose solo-focus-architect-body solo-focus-copy-width solo-focus-content-text text-left m-0 zz-body-bold text-sm md:text-base lg:text-lg leading-relaxed"
          style={proseStyle}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}
