/**
 * Zone bento honesty labels — when profile £ is shown before Neon research settles.
 */

export type ZoneAuditState = 'LIVE_AUDIT' | 'ESTIMATED_AUDIT' | 'PROPERTY_VERIFIED'

export const ZONE_ESTIMATED_INSIGHT_STRIP =
  'Estimated from your profile — local audit still loading.'

export function shouldShowZoneEstimatedInsightStrip(params: {
  auditState?: ZoneAuditState | null
  researchSettled: boolean
  moneyGbp: number
}): boolean {
  if (params.researchSettled) return false
  if (params.auditState !== 'ESTIMATED_AUDIT') return false
  return params.moneyGbp > 0
}

export function resolveZoneAuditState(params: {
  hasVerifiedNeonMoney: boolean
  genomeIncomplete: boolean
  propertyIntelligenceConfidence?: string | null
}): ZoneAuditState {
  if (params.hasVerifiedNeonMoney && !params.genomeIncomplete) return 'LIVE_AUDIT'
  if (params.propertyIntelligenceConfidence === 'ADDRESS_MATCHED') return 'PROPERTY_VERIFIED'
  return 'ESTIMATED_AUDIT'
}
