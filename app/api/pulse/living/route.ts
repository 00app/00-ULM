import { NextRequest, NextResponse } from 'next/server'
import { getLocalData } from '@/lib/local/getLocalData'
import { fetchLivingPulseSnapshot } from '@/lib/logic/pulse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public read — Ofgem / grid scraping stays server-side (no browser → ofgem.gov.uk). */
export async function GET(request: NextRequest) {
  const postcode =
    request.nextUrl.searchParams.get('postcode')?.replace(/\s+/g, '').trim().toUpperCase() ?? ''
  if (postcode.length < 4) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  if (postcode.length > 12) {
    return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
  }
  try {
    const local = await getLocalData(postcode).catch(() => null)
    const snapshot = await fetchLivingPulseSnapshot(postcode, local)
    return NextResponse.json(snapshot)
  } catch (e) {
    console.error('[pulse/living] GET error:', e)
    return NextResponse.json({ error: 'pulse failed' }, { status: 500 })
  }
}
