import type { NextRequest } from 'next/server'
import { normalizeSecret, secretMeetsMinLength } from '@/lib/intelligence/normalizeSecret'

function isTruthyQueryFlag(v: string | null | undefined): boolean {
  return ['1', 'true', 'yes'].includes(String(v ?? '').toLowerCase())
}

function isTruthyBodyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (typeof v === 'string') return isTruthyQueryFlag(v)
  return false
}

function hasPostcodeInQuery(searchParams: URLSearchParams): boolean {
  const pc = (searchParams.get('postcode') ?? '').replace(/\s+/g, '').trim()
  return pc.length >= 4
}

/** Hermes / manual VPS pulses: `{ "source": "manual-pulse" }` + `?postcode=&full=true`. */
function isHermesPulseBody(body: Record<string, unknown>): boolean {
  const src = String(body.source ?? body.origin ?? '').toLowerCase()
  if (!src) return false
  return (
    src.includes('hermes') ||
    src.includes('manual-pulse') ||
    src.includes('manual-trigger') ||
    src.includes('sovereign-trigger') ||
    src.includes('manual-force')
  )
}

/**
 * POST trigger handshake — query `force` / `mode=trigger` / `full=true` or JSON `{ trigger: true }`.
 * When true, `scraped` / `scrapedData` arrays are not required (empty `[]` is fine).
 */
export function scrapeSyncTriggerRequested(
  searchParams: URLSearchParams,
  body: Record<string, unknown>
): boolean {
  if (isTruthyBodyFlag(body.trigger)) return true
  if (isTruthyBodyFlag(body.full)) return true
  const mode = String(body.mode ?? searchParams.get('mode') ?? '').toLowerCase()
  if (mode === 'trigger' || mode === 'full') return true
  /** Hermes lifestyle_shift POST: `trigger` + `?force=true` + `lifestyle_mode` (not `mode`). */
  if (mode === 'lifestyle_shift' && isTruthyBodyFlag(body.trigger)) return true
  if (mode === 'lifestyle_shift' && isTruthyQueryFlag(searchParams.get('force'))) return true
  if (isTruthyQueryFlag(searchParams.get('force'))) return true
  if (isTruthyQueryFlag(searchParams.get('trigger'))) return true
  if (isTruthyQueryFlag(searchParams.get('full'))) return true
  if (hasPostcodeInQuery(searchParams) && isHermesPulseBody(body)) return true
  return false
}

/** Normalize trigger flags on the parsed POST body (Hermes / curl / Solo Focus). */
export function applyScrapeSyncTriggerFlags(
  searchParams: URLSearchParams,
  body: Record<string, unknown>
): Record<string, unknown> {
  if (!scrapeSyncTriggerRequested(searchParams, body)) return body
  body.trigger = true
  const pc =
    typeof body.postcode === 'string' ? body.postcode.replace(/\s+/g, '').trim().toUpperCase() : ''
  const qPostcode = (searchParams.get('postcode') ?? '').replace(/\s+/g, '').trim().toUpperCase()
  if (pc.length < 4 && qPostcode.length >= 4) body.postcode = qPostcode
  return body
}

const MIN_LEN = 16

/** Scrape-sync service bearer — **SCRAPER_SECRET only** (not CRON_SECRET). */
export function configuredScraperBearerKeys(): string[] {
  const v = normalizeSecret(process.env.SCRAPER_SECRET)
  if (secretMeetsMinLength(v, MIN_LEN)) return [v]
  return []
}

/** @deprecated Use {@link configuredScraperBearerKeys} — cron uses CRON_SECRET on `/api/cron/*` only. */
export function configuredScrapeSyncBearerKeys(): string[] {
  return configuredScraperBearerKeys()
}

export function scraperBearerFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')?.trim()
  const bearer =
    auth && /^bearer\s+/i.test(auth) ? normalizeSecret(auth.replace(/^Bearer\s+/i, '')) : null
  if (bearer) return bearer
  const scraper = normalizeSecret(request.headers.get('x-scraper-secret'))
  return scraper || null
}

export function scraperServiceBearerMatches(request: NextRequest): boolean {
  const got = scraperBearerFromRequest(request)
  if (!got) return false
  return configuredScraperBearerKeys().includes(got)
}

/** Alias — scrape-sync POST triggers accept SCRAPER_SECRET only. */
export function scrapeSyncBearerMatches(request: NextRequest): boolean {
  return scraperServiceBearerMatches(request)
}

export function scrapeSyncAuthConfigured(): boolean {
  return configuredScraperBearerKeys().length > 0
}

export function scrapeSyncAuthDeniedResponse(): {
  status: 503 | 401
  body: Record<string, unknown>
} {
  if (!scrapeSyncAuthConfigured()) {
    return {
      status: 503,
      body: {
        error: 'API auth not configured',
        hint:
          'Set SCRAPER_SECRET (≥16 chars) on this Vercel environment, then redeploy. Send Authorization: Bearer <SCRAPER_SECRET> or x-scraper-secret header. CRON_SECRET is for /api/cron/* only.',
        expects: ['SCRAPER_SECRET'],
      },
    }
  }
  return { status: 401, body: { error: 'Unauthorized' } }
}
