import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { passesAdminApiMiddlewareGate } from '@/lib/adminApiGate'
import { attachGuestSessionCookieIfMissing } from '@/lib/proxyGuestCookie'

/** Public GET — Zone reads cached Neon research without a session (no auth in proxy). */
const PUBLIC_GET_API_PREFIXES = [
  '/api/scrape-sync',
  '/api/summary',
  '/api/health',
  '/api/pulse/living',
  '/api/user',
  '/api/likes',
] as const

/** Next.js 16+: `proxy` replaces root `middleware` for network-boundary logic. */
export function proxy(request: NextRequest) {
  if (request.method === 'GET') {
    const path = request.nextUrl.pathname
    if (PUBLIC_GET_API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return attachGuestSessionCookieIfMissing(request, NextResponse.next())
    }
  }

  const path = request.nextUrl.pathname
  const isAdminApi = path.startsWith('/api/admin')
  const isAdminPulsePage = path === '/admin/pulse' || path.startsWith('/admin/pulse/')
  if (isAdminApi || isAdminPulsePage) {
    if (!passesAdminApiMiddlewareGate(request)) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }
  }

  return attachGuestSessionCookieIfMissing(request, NextResponse.next())
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/admin/pulse',
    '/admin/pulse/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
