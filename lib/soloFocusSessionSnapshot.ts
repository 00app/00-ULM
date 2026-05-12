/**
 * §18.5.4 — Persist Solo Focus RESULT + morph deck so a full reload still shows the archived tip.
 * View flag stays in `zz_sf_view_${cardId}`; payload lives in `zz_sf_snap_${cardId}`.
 */
export const SOLO_FOCUS_SNAPSHOT_V = 1 as const

export type SoloFocusCitationSnap = {
  label: string
  url?: string
  verifiedAt?: string
}

export type SoloFocusResultSnapshotV1 = {
  v: typeof SOLO_FOCUS_SNAPSHOT_V
  journeyId: string
  resultCitation: SoloFocusCitationSnap | null
  liveClaimUrl: string | null
  discoverySnap: { questionId: string; answerValue: string } | null
  geminiRecommendationCopy: string | null
  discoveryWinLine: string | null
  birthedZoneTitle: string | null
  gridContext: {
    intensity_g_per_kwh: number | null
    cleaner_vs_2025_pct: number | null
  } | null
  researchAttribution: { headline?: string | null; supplied_by?: string | null } | null
  morphDeck: unknown[]
  morphDeckCursor: number
}

export function soloFocusSnapStorageKeys(cardId: string | undefined, journeyId: string) {
  const hasCard = cardId && String(cardId).length > 0
  return {
    viewKey: hasCard ? `zz_sf_view_${cardId}` : `journey_${journeyId}_solo_focus_view`,
    snapKey: hasCard ? `zz_sf_snap_${cardId}` : `journey_${journeyId}_solo_focus_snap`,
  }
}

export function readSoloFocusSnapshot(
  snapKey: string,
  journeyId: string
): SoloFocusResultSnapshotV1 | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(snapKey)
    if (!raw) return null
    const o = JSON.parse(raw) as SoloFocusResultSnapshotV1
    if (o?.v !== SOLO_FOCUS_SNAPSHOT_V || o.journeyId !== journeyId) return null
    const morphDeck = Array.isArray(o.morphDeck) ? o.morphDeck : []
    const morphDeckCursor =
      typeof o.morphDeckCursor === 'number' && o.morphDeckCursor >= 0 ? o.morphDeckCursor : 0
    return {
      ...o,
      morphDeck,
      morphDeckCursor,
    }
  } catch {
    return null
  }
}

export function writeSoloFocusSnapshot(snapKey: string, snap: SoloFocusResultSnapshotV1): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(snapKey, JSON.stringify(snap))
  } catch {
    // quota / private mode
  }
}

export function clearSoloFocusSnapshot(snapKey: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(snapKey)
  } catch {
    // ignore
  }
}
