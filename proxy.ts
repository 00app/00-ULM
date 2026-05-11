import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { passesAdminApiMiddlewareGate } from '@/lib/adminApiGate'

/** Next.js 16+: `proxy` replaces root `middleware` for network-boundary logic. */
export function proxy(request: NextRequest) {
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
