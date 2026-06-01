/**
 * Zone tips inject — validate and append tip cards to the in-memory injection store.
 */

import { NextRequest, NextResponse } from 'next/server'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!gatewayTokenMatches(request)) {
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
