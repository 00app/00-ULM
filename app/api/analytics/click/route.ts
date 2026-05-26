export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const text = await request.text()
    if (text) {
      const data = JSON.parse(text)
      console.log('[Analytics] Click tracked:', data)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Analytics] Error tracking click:', error)
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 })
  }
}
