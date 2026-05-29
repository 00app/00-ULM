/**
 * Per-journey research row gates — same rules as Zone / Solo Focus display.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import {
  headlineConflictsWithJourney,
  isAcceptableZoneJourneyHeadline,
} from '@/lib/soloFocusCopy'
import {
  journeyResearchSettled,
  type ResearchCategoryCoverageRow,
} from '@/lib/researchSyncClient'
import {
  proseViolatesJourneyCategory,
  sanitizeArchitectProseForJourney,
} from '@/lib/zone/contentProseSanitize'

export type JourneyGateStatus = 'settled' | 'unsettled' | 'missing'

export type JourneyGateReport = {
  journeyId: JourneyId
  status: JourneyGateStatus
  issues: string[]
  savingGbp: number | null
  hasOffer: boolean
}

export function auditJourneyResearchGate(
  journeyId: JourneyId,
  row: ResearchCategoryCoverageRow | undefined | null
): JourneyGateReport {
  const issues: string[] = []
  const savingGbp = row?.latestSavingGbp ?? row?.latestVerifiedGbp ?? null
  const hasOffer = row?.hasOffer === true

  if (!row?.insightReady) {
    return {
      journeyId,
      status: 'missing',
      issues: ['no_neon_row'],
      savingGbp,
      hasOffer,
    }
  }

  const prose = row.architectProse?.trim() ?? ''
  const headline = row.agentHeadline?.trim() ?? ''

  if (prose) {
    if (sanitizeArchitectProseForJourney(journeyId, prose) == null) {
      issues.push('prose_sanitizer_rejected')
    }
    if (proseViolatesJourneyCategory(journeyId, prose)) {
      issues.push('prose_category_bleed')
    }
  }

  if (headline) {
    if (!isAcceptableZoneJourneyHeadline(journeyId, headline)) {
      issues.push('headline_not_acceptable')
    }
    if (headlineConflictsWithJourney(journeyId, headline)) {
      issues.push('headline_topic_conflict')
    }
  }

  const settled = journeyResearchSettled(row, { journeyId })
  if (!settled && issues.length === 0) {
    issues.push('not_settled')
  }

  return {
    journeyId,
    status: settled ? 'settled' : 'unsettled',
    issues,
    savingGbp,
    hasOffer,
  }
}

export function auditAllJourneyResearchGates(
  coverage: Partial<Record<string, ResearchCategoryCoverageRow>>
): JourneyGateReport[] {
  return JOURNEY_ORDER.map((jid) =>
    auditJourneyResearchGate(jid, coverage[jid] ?? coverage[jid.toLowerCase()])
  )
}
