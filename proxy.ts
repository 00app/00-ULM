import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { passesAdminApiMiddlewareGate } from '@/lib/adminApiGate'

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
      return NextResponse.next()
    }
  }

  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    if (!passesAdminApiMiddlewareGate(request)) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
      })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*'],
}
