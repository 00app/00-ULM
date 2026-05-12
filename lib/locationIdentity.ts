/**
 * Location identity — human label for “In {place}” copy and opener grounding.
 * Uses LocalIntelligence from Postcodes.io (via getLocalData) + light postcode fallbacks.
 */

import type { LocalIntelligence } from '@/lib/local/getLocalData'

function stripAdministrativeNoise(s: string): string {
  return s
    .replace(/\s+(ward|parish|council|district|borough)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Prefer parish / ward fragment / council for display (e.g. settlement name, “Westminster”).
 */
export function formatLocationDisplayName(
  local: LocalIntelligence | null | undefined,
  postcode?: string | null
): string {
  const loc =
    (local?.locality && local.locality.trim()) ||
    (local?.ward && stripAdministrativeNoise(local.ward.split(',')[0] ?? local.ward)) ||
    (local?.council && local.council.trim() && local.council.toLowerCase() !== 'unknown'
      ? local.council.trim()
      : '')

  if (loc) return stripAdministrativeNoise(loc)

  const pc = postcode?.replace(/\s+/g, '').toUpperCase() ?? ''
  if (local?.outcode) return local.outcode
  const spaced = postcode?.replace(/\s+/g, ' ').trim()
  return pc ? pc.slice(0, 4) : spaced || ''
}

/** Phrase for UI: “In {locality}” (caller supplies leading copy). */
export function locationInPhrase(displayName: string): string {
  const t = displayName.trim()
  if (!t) return ''
  return `In ${t}`
}
