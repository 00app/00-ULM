import type { NextRequest } from 'next/server'
import { normalizeSecret } from '@/lib/intelligence/normalizeSecret'

/** Ops / admin gateway bearer — separate from `CRON_SECRET` (scheduled jobs). */
export function configuredGatewayToken(): string | null {
  const v = normalizeSecret(process.env.GATEWAY_TOKEN)
  return v.length >= 16 ? v : null
}

export function gatewayTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')?.trim()
  const bearer =
    auth && /^bearer\s+/i.test(auth) ? normalizeSecret(auth.replace(/^Bearer\s+/i, '')) : null
  if (bearer) return bearer
  const header = normalizeSecret(request.headers.get('x-gateway-token'))
  return header || null
}

export function gatewayTokenMatches(request: NextRequest): boolean {
  const expected = configuredGatewayToken()
  if (!expected) return false
  const got = gatewayTokenFromRequest(request)
  return Boolean(got && got === expected)
}
