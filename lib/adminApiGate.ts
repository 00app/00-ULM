import type { NextRequest } from 'next/server'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'

/** Middleware gate: HTTP Basic (`ADMIN_PASSWORD`) or `GATEWAY_TOKEN` bearer — not `CRON_SECRET`. */
export function passesAdminApiMiddlewareGate(request: NextRequest): boolean {
  return adminBasicAuthMatches(request) || gatewayTokenMatches(request)
}
