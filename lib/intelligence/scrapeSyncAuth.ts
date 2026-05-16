import type { NextRequest } from 'next/server'
import { normalizeSecret, secretMeetsMinLength } from '@/lib/intelligence/normalizeSecret'

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
