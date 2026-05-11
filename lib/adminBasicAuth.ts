import type { NextRequest } from 'next/server'
import { DEFAULT_ADMIN_BASIC_AUTH_HEADER } from '@/lib/adminBasicAuth.shared'

export { DEFAULT_ADMIN_BASIC_AUTH_HEADER }

/**
 * Basic auth for `/api/admin/*`. Set `ADMIN_BASIC_AUTH` to the full header value, e.g.
 * `Basic <base64(user:pass)>`.
 */
export function getExpectedAdminBasicAuth(): string {
  return process.env.ADMIN_BASIC_AUTH?.trim() || DEFAULT_ADMIN_BASIC_AUTH_HEADER
}

export function adminBasicAuthMatches(request: NextRequest): boolean {
  const got = request.headers.get('authorization')
  return got === getExpectedAdminBasicAuth()
}
