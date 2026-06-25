import { type LocalIntelligence } from '@/lib/local/getLocalData'
import { formatLocationDisplayName } from '@/lib/locationIdentity'
import { isRealLocalityLabel } from '@/lib/brains/summaryLogic'

import { formatPostcodeOutcodeFallback, isValidUkPostcode } from '@/lib/geocode/ukPostcode'

export const PROFILE_LOCALITY_NAME_KEY = 'profile_locality_name'
export const PROFILE_LOCALITY_POSTCODE_KEY = 'profile_locality_postcode'

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_USER_AGENT = 'ZeroZeroApp/1.0 (uk-savings; contact@zero-zero.app)'

type NominatimAddress = Record<string, string | undefined>

export type NominatimSearchRow = {
  display_name?: string
  address?: NominatimAddress
}

function titleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function compactUkPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, '').toUpperCase()
}

/** Display-friendly outcode when locality is not ready yet (e.g. SW12). */
export function formatPostcodeFallback(postcode: string): string {
  return formatPostcodeOutcodeFallback(postcode)
}

/** Prefer suburb + town; else first two segments of display_name. */
export function localityLabelFromNominatimRow(row: NominatimSearchRow): string | null {
  const address = row.address ?? {}
  const suburb = (address.suburb ?? address.neighbourhood ?? address.hamlet ?? '').trim()
  const town = (address.town ?? address.city ?? address.village ?? address.municipality ?? '').trim()

  if (suburb && town && suburb.toLowerCase() !== town.toLowerCase()) {
    return `${titleCaseWords(suburb)}, ${titleCaseWords(town)}`
  }
  const primary = town || suburb
  if (primary) return titleCaseWords(primary)

  const display = row.display_name?.trim()
  if (!display) return null
  const parts = display.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return `${titleCaseWords(parts[0])}, ${titleCaseWords(parts[1])}`
  }
  if (parts.length === 1) return titleCaseWords(parts[0])
  return null
}

/** Server: forward geocode UK postcode → locality label. */
export async function fetchLocalityFromNominatim(postcode: string): Promise<string | null> {
  const pc = compactUkPostcode(postcode)
  if (pc.length < 4) return null
  const url = new URL(NOMINATIM_SEARCH)
  url.searchParams.set('postalcode', pc)
  url.searchParams.set('countrycodes', 'gb')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = (await res.json()) as NominatimSearchRow[]
    const row = rows?.[0]
    if (!row) return null
    return localityLabelFromNominatimRow(row)
  } catch {
    return null
  }
}

export function readCachedProfileLocality(postcode: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const cachedPc = localStorage.getItem(PROFILE_LOCALITY_POSTCODE_KEY)
    const name = localStorage.getItem(PROFILE_LOCALITY_NAME_KEY)?.trim()
    if (!name || !cachedPc) return null
    if (compactUkPostcode(cachedPc) !== compactUkPostcode(postcode)) return null
    if (!isRealLocalityLabel(name)) {
      localStorage.removeItem(PROFILE_LOCALITY_NAME_KEY)
      localStorage.removeItem(PROFILE_LOCALITY_POSTCODE_KEY)
      return null
    }
    return name
  } catch {
    return null
  }
}

export function persistProfileLocality(postcode: string, localityName: string): void {
  if (typeof window === 'undefined') return
  const name = localityName.trim()
  if (!name) return
  try {
    localStorage.setItem(PROFILE_LOCALITY_NAME_KEY, name)
    localStorage.setItem(PROFILE_LOCALITY_POSTCODE_KEY, compactUkPostcode(postcode))
  } catch {
    /* blocked storage */
  }
}

export function clearProfileLocalityCache(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PROFILE_LOCALITY_NAME_KEY)
    localStorage.removeItem(PROFILE_LOCALITY_POSTCODE_KEY)
  } catch {
    /* ignore */
  }
}

/** Client: cache → API → postcode fallback. */
export async function resolveProfileLocalityForPostcode(
  postcode: string
): Promise<{ label: string; source: 'cache' | 'nominatim' | 'postcode' }> {
  const fallback = formatPostcodeFallback(postcode)
  const cached = readCachedProfileLocality(postcode)
  if (cached) return { label: cached, source: 'cache' }

  try {
    const pc = compactUkPostcode(postcode)
    if (pc.length >= 4) {
      const res = await fetch(`/api/geocode/postcode?postcode=${encodeURIComponent(pc)}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const body = (await res.json()) as { locality?: string }
        const locality = typeof body.locality === 'string' ? body.locality.trim() : ''
        if (locality) {
          persistProfileLocality(postcode, locality)
          return { label: locality, source: 'nominatim' }
        }
      }
    }
  } catch {
    /* offline */
  }

  return { label: fallback, source: 'postcode' }
}

export type ProfileLocalityHandoff = {
  label: string
  local: LocalIntelligence | null
}

/** Profile → summary handoff: server locality API (Postcodes.io + parish/council). */
export async function prefetchProfileLocalityForHandoff(
  postcode: string
): Promise<ProfileLocalityHandoff> {
  const pc = compactUkPostcode(postcode)
  if (pc.length < 4) return { label: '', local: null }

  const cached = readCachedProfileLocality(pc)
  if (cached && isRealLocalityLabel(cached)) return { label: cached, local: null }

  try {
    const res = await fetch(`/api/profile/locality?postcode=${encodeURIComponent(pc)}`, {
      credentials: 'include',
      cache: 'no-store',
    })
    if (res.ok) {
      const body = (await res.json()) as {
        label?: string
        local?: LocalIntelligence | null
      }
      const local = body.local ?? null
      const label = (body.label ?? '').trim()
      if (isRealLocalityLabel(label)) {
        persistProfileLocality(pc, label)
        return { label, local }
      }
      if (local) {
        const fromLocal = formatLocationDisplayName(local, pc).trim()
        const fromCouncil = local.council?.trim() ?? ''
        const resolved =
          (isRealLocalityLabel(fromLocal) ? fromLocal : '') ||
          (isRealLocalityLabel(fromCouncil) ? fromCouncil : '')
        if (isRealLocalityLabel(resolved)) {
          persistProfileLocality(pc, resolved)
          return { label: resolved, local }
        }
      }
    }
  } catch {
    /* offline */
  }

  return { label: '', local: null }
}
