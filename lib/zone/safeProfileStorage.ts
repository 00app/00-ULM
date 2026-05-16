/** Guest / blocked-storage fallback — BN17 has live Neon research rows. */
export const DEFAULT_ZONE_POSTCODE = 'BN17'

const PROFILE_POSTCODE_KEY = 'profile_postcode'

export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeGetJson<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function readPostcodeFromUrl(): string {
  if (typeof window === 'undefined') return ''
  try {
    const q = new URLSearchParams(window.location.search).get('postcode')?.replace(/\s+/g, '').trim()
    return q && q.length >= 4 ? q.toUpperCase() : ''
  } catch {
    return ''
  }
}

export function readPostcodeFromStorage(): string {
  const v = safeGetItem(PROFILE_POSTCODE_KEY)
  return v ? v.replace(/\s+/g, '').toUpperCase() : ''
}

/** URL → storage → BN17 when storage is blocked or empty. */
export function readProfilePostcode(): string {
  const fromUrl = readPostcodeFromUrl()
  if (fromUrl.length >= 4) return fromUrl
  const fromStorage = readPostcodeFromStorage()
  if (fromStorage.length >= 4) return fromStorage
  return DEFAULT_ZONE_POSTCODE
}

export function resolveScrapePostcode(livePostcode?: string | null, profilePostcode?: string | null): string {
  const raw = (livePostcode ?? profilePostcode ?? readPostcodeFromUrl() ?? readPostcodeFromStorage() ?? DEFAULT_ZONE_POSTCODE)
    .replace(/\s+/g, '')
    .trim()
  return raw.length >= 4 ? raw.toUpperCase() : DEFAULT_ZONE_POSTCODE
}

export function readProfileFieldsFromStorage(): {
  name?: string
  postcode?: string
  household?: string
  home_type?: string
  transport_baseline?: string
  age?: string
  employment_status?: string
} {
  return {
    name: safeGetItem('profile_name') ?? undefined,
    postcode: safeGetItem('profile_postcode') ?? undefined,
    household: safeGetItem('profile_household') ?? undefined,
    home_type: safeGetItem('profile_home_type') ?? undefined,
    transport_baseline: safeGetItem('profile_transport') ?? undefined,
    age: safeGetItem('profile_age') ?? undefined,
    employment_status: safeGetItem('profile_employment_status') ?? undefined,
  }
}
