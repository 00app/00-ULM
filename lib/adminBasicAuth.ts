import type { NextRequest } from 'next/server'
import { getAdminAuthHeader } from '@/lib/adminBasicAuth.shared'

/**
 * Basic auth for `/api/admin/*`. Set `ADMIN_BASIC_AUTH` to the full header value, e.g.
 * `Basic <base64(user:pass)>`. Falls back to `ADMIN_AUTH_HEADER` if unset.
 */
export function getExpectedAdminBasicAuth(): string {
  return process.env.ADMIN_BASIC_AUTH?.trim() || getAdminAuthHeader()
}

export function adminBasicAuthMatches(request: NextRequest): boolean {
  const got = request.headers.get('authorization')
  return got === getExpectedAdminBasicAuth()
}
