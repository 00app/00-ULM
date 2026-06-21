import type { NextRequest } from 'next/server'
import { adminBasicAuthMatches } from '@/lib/adminBasicAuth'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'

/** Ops / admin bearer or Basic — not end-user session cookies. */
export function isOpsAuthorized(request: NextRequest): boolean {
  return gatewayTokenMatches(request) || adminBasicAuthMatches(request)
}
