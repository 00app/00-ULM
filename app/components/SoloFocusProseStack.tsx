'use client'

import {
  layoutSoloFocusProseBlocks,
  toThreeTrueTipParagraphs,
  polishTrueTipParagraphsForHeadline,
} from '@/lib/soloFocusCopy'
import { personalizeTrueTipPlaceLead } from '@/lib/zone/localityCopy'

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
}: SoloFocusProseStackProps) {
  const triple = polishTrueTipParagraphsForHeadline(
    headline,
    toThreeTrueTipParagraphs(insightSource, {
      journeyId,
      moneyGbp,
      carbonKg,
      userPostcode,
      sourceDisplayName,
      auditHeaderLocality,
      includePayoffParagraph: false,
    })
  )
  const personalized = personalizeTrueTipPlaceLead(triple, {
    locality: locality ?? undefined,
    postcode: postcode ?? undefined,
  }) as [string, string, string]
  const { subheading, body } = layoutSoloFocusProseBlocks(headline, personalized, {
    journeyId,
    moneyGbp,
    carbonKg,
  })
  const bodyLead = body.slice(0, 1)

  if (!subheading && bodyLead.length === 0) return null

  const proseStyle = { color: 'var(--journey-text)' as const }

  return (
    <div className="solo-focus-true-tip-sections solo-focus-true-tip-sections--mother flex flex-col gap-0 w-full min-w-0">
      {subheading ? (
        <h4
          className="solo-focus-architect-prose solo-focus-architect-lead solo-focus-copy-width solo-focus-content-text text-left m-0 text-marvin zz-h4"
          style={proseStyle}
        >
          {subheading}
        </h4>
      ) : null}
      {bodyLead.map((para) => (
        <p
          key={para.slice(0, 48)}
          className="solo-focus-architect-prose solo-focus-architect-body solo-focus-copy-width solo-focus-content-text text-left m-0"
          style={proseStyle}
        >
          {para}
        </p>
      ))}
    </div>
  )
}
