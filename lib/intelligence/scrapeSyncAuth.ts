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

/** Bearer / header values accepted for POST /api/scrape-sync (server + Hermes). */
export function configuredScrapeSyncBearerKeys(): string[] {
  const names = ['SCRAPER_SECRET', 'CRON_SECRET', 'GATEWAY_TOKEN'] as const
  const out: string[] = []
  for (const name of names) {
    const v = normalizeSecret(process.env[name])
    if (v.length >= MIN_LEN) out.push(v)
  }
  return [...new Set(out)]
}

export function scrapeSyncBearerFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')?.trim()
  const bearer =
    auth && /^bearer\s+/i.test(auth) ? normalizeSecret(auth.replace(/^Bearer\s+/i, '')) : null
  if (bearer) return bearer
  const cron = normalizeSecret(request.headers.get('x-cron-secret'))
  if (cron) return cron
  const scraper = normalizeSecret(request.headers.get('x-scraper-secret'))
  if (scraper) return scraper
  const gateway = normalizeSecret(request.headers.get('x-gateway-token'))
  return gateway || null
}

export function scrapeSyncBearerMatches(request: NextRequest): boolean {
  const got = scrapeSyncBearerFromRequest(request)
  if (!got) return false
  const keys = configuredScrapeSyncBearerKeys()
  return keys.includes(got)
}

export function scrapeSyncAuthConfigured(): boolean {
  return configuredScrapeSyncBearerKeys().length > 0
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
          'Set SCRAPER_SECRET or CRON_SECRET (≥16 chars) on this Vercel environment, then redeploy. Send Authorization: Bearer <same secret>.',
        expects: ['SCRAPER_SECRET', 'CRON_SECRET', 'GATEWAY_TOKEN'],
      },
    }
  }
  return { status: 401, body: { error: 'Unauthorized' } }
}
