/**
 * Local Living — Postcodes.io + Carbon Intensity.
 * GET ?postcode=SW1A1AA returns council, region, localCarbon (gCO₂/kWh), ward.
 * No auth; used by Zone dashboard to show "Local" tag and Local Pulse badge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLocalData } from '@/lib/local/getLocalData'

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode')?.trim()
  if (!postcode) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  const data = await getLocalData(postcode)
  if (!data) {
    return NextResponse.json({ error: 'Could not resolve postcode' }, { status: 404 })
  }
  return NextResponse.json(data)
}
