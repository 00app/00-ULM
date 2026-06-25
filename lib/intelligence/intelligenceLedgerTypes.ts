import type { JourneyId } from '@/lib/journeys'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { ZoneAuditState } from '@/lib/zone/zoneAuditUi'

export type TruthLedgerDisplayStatus = 'settled' | 'computing' | 'bleed' | 'estimated'

export type TruthLedgerJourneyRow = {
  journeyId: JourneyId
  displayStatus: TruthLedgerDisplayStatus
  issues: string[]
  savingGbp: number | null
  verifiedSavingGbp: number | null
  verified: boolean
  hasOffer: boolean
  offerUrl: string | null
  sourceUrl: string | null
  lastVisitedAt: string | null
  agentHeadline: string | null
}

export type TruthLedgerSignal = {
  signal: string
  cardId: string
  journeyKey: string | null
  cardTitle: string | null
  feedbackAnswer: string | null
  moneyGbp: number | null
  at: string
}

export type TruthLedgerProfileSlice = {
  name: string | null
  postcode: string | null
  goal: string | null
  homePower: string | null
  transport: string | null
  employmentStatus: string | null
  homeType: string | null
  profileStepsComplete: number
  profileStepsTotal: number
  propertyPrefillCount: number
}

export type TruthLedgerCounts = {
  likes: number
  dislikes: number
  indifferent: number
  actioned: number
  visitedJourneys: number
  loopAnswersAnswered: number
  loopQuestionsTotal: number
  potentialSavings: number
  truthSavings: number
}

export type IntelligenceLedger = {
  generatedAt: string
  userId: string
  auditState: ZoneAuditState
  counts: TruthLedgerCounts
  profile: TruthLedgerProfileSlice
  propertyIntelligence: PropertyIntelligence | null
  recentSignals: TruthLedgerSignal[]
  journeys: TruthLedgerJourneyRow[]
}
