import type { NextRequest } from 'next/server'
import { passesAdminApiMiddlewareGate } from '@/lib/adminApiGate'

/** Ops / admin bearer or Basic — not end-user session cookies.
 *  Same check as `passesAdminApiMiddlewareGate` (lib/adminApiGate.ts, used by proxy.ts) — kept
 *  as its own named export since callers here think in terms of "ops auth", not "middleware
 *  gate", but the two were duplicated logic that could drift out of sync, so this just delegates. */
export function isOpsAuthorized(request: NextRequest): boolean {
  return passesAdminApiMiddlewareGate(request)
}
