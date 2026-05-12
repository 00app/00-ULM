/**
 * Zone tips inject — validate and append tip cards to the in-memory injection store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'

export const dynamic = 'force-dynamic'

function authorizeGatewayInject(request: NextRequest): boolean {
  const expected = process.env.GATEWAY_TOKEN?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  if (!expected) return false
  const got =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim() ??
    request.headers.get('x-gateway-token')?.trim()
  return got === expected
}

export async function POST(request: NextRequest) {
  try {
    if (!authorizeGatewayInject(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const injected = persistZoneTipInjectBody(body)
    return NextResponse.json({ ok: true, injected })
  } catch (e) {
    console.error('[zone/tips-inject] error:', e)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
