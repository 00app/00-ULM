/**
 * Zone bento honesty labels — when profile £ is shown before Neon research settles.
 */

export const ZONE_ESTIMATED_INSIGHT_STRIP =
  'Estimated from your profile — local audit still loading.'

export function shouldShowZoneEstimatedInsightStrip(params: {
  auditState?: 'LIVE_AUDIT' | 'ESTIMATED_AUDIT' | null
  researchSettled: boolean
  moneyGbp: number
}): boolean {
  if (params.researchSettled) return false
  if (params.auditState !== 'ESTIMATED_AUDIT') return false
  return params.moneyGbp > 0
}
