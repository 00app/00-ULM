/**
 * Carbon Truth (M-2) — single path for UK grid intensity (gCO₂/kWh).
 * Live: NESO / Carbon Intensity API via `fetchNesoGridIntensity`.
 * Offline: regional tier from `getCarbonIntensity` (never a second hardcoded 129 vs 140 split).
 */

import type { LocalIntelligence } from '@/lib/local/getLocalData'
import { REG_GB_BASE_G_PER_KWH } from '@/lib/brains/constants'
import { fetchNesoGridIntensity } from '@/lib/intelligence/nesoGridClient'

/** GB-wide fallback when postcode is unknown or API + tier both fail (gCO₂/kWh). */
export const GB_GRID_FALLBACK_G_PER_KWH = REG_GB_BASE_G_PER_KWH

/** Structural matrix normalisation baseline — same as GB tier fallback. */
export const STRUCTURAL_REF_GRID_INTENSITY_G = REG_GB_BASE_G_PER_KWH

export type GridCarbonContext = {
  intensityGPerKwh: number
  elecCarbonKgPerKwh: number
}

export function electricityCarbonFactorKgFromIntensityG(intensityG: number): number {
  if (!Number.isFinite(intensityG) || intensityG <= 0) {
    return GB_GRID_FALLBACK_G_PER_KWH / 1000
  }
  return intensityG / 1000
}

export function gridCarbonContextFromIntensityG(intensityG: number): GridCarbonContext {
  const g = Math.max(1, Math.round(intensityG))
  return {
    intensityGPerKwh: g,
    elecCarbonKgPerKwh: electricityCarbonFactorKgFromIntensityG(g),
  }
}

/** Sync tier/live-local fallback — use when async NESO fetch is unavailable (client bundle). */
export function syncFallbackGridIntensityGPerKwh(
  postcode?: string | null,
  local?: LocalIntelligence | null
): number {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return GB_GRID_FALLBACK_G_PER_KWH
  const live = local?.localCarbonG
  if (typeof live === 'number' && Number.isFinite(live) && live > 0) {
    return live
  }
  if (/^(KW|IV|HS|ZE|PH)/.test(pc)) return 170
  const region = String(local?.region ?? '').toLowerCase()
  const council = String(local?.council ?? '').toLowerCase()
  if (region.includes('london') || council.includes('manchester') || council.includes('birmingham')) {
    return 110
  }
  return GB_GRID_FALLBACK_G_PER_KWH
}

export function gridCarbonContextForPostcode(
  postcode?: string | null,
  local?: LocalIntelligence | null
): GridCarbonContext {
  return gridCarbonContextFromIntensityG(syncFallbackGridIntensityGPerKwh(postcode, local))
}

/** Live regional intensity from NESO / Carbon Intensity API; tier fallback when offline. */
export async function resolveUnifiedGridIntensityGPerKwh(
  postcode?: string | null
): Promise<number> {
  const pc = (postcode ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4) return GB_GRID_FALLBACK_G_PER_KWH
  const snap = await fetchNesoGridIntensity(pc).catch(() => null)
  if (snap?.intensityG && snap.intensityG > 0) return snap.intensityG
  return syncFallbackGridIntensityGPerKwh(pc)
}

/** Async NESO-backed carbon context for server routes and Zone hydration. */
export async function resolveGridCarbonContextForPostcode(
  postcode?: string | null
): Promise<GridCarbonContext> {
  const g = await resolveUnifiedGridIntensityGPerKwh(postcode)
  return gridCarbonContextFromIntensityG(g)
}

/** @deprecated Use `resolveUnifiedGridIntensityGPerKwh` */
export async function resolveLiveElectricityCarbonFactorKg(
  postcode?: string | null
): Promise<number> {
  const ctx = await resolveGridCarbonContextForPostcode(postcode)
  return ctx.elecCarbonKgPerKwh
}
