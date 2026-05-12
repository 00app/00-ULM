import type { NextRequest } from 'next/server'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'

/** Same bearer/env gate as `app/api/admin/pulse/route.ts` — scripts cannot send Basic + Bearer in one header. */
function gatewayTokenMatches(request: NextRequest): boolean {
  const expected =
    process.env.GATEWAY_TOKEN?.trim() ||
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!expected) return false
  const got =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim() ??
    request.headers.get('x-gateway-token')?.trim()
  return got === expected
}

/** Middleware gate: HTTP Basic or gateway bearer (never DB/session — edge-safe). */
export function passesAdminApiMiddlewareGate(request: NextRequest): boolean {
  return adminBasicAuthMatches(request) || gatewayTokenMatches(request)
}
