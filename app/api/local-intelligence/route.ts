/**
 * Local Living — Postcodes.io + Carbon Intensity.
 * GET ?postcode=SW1A1AA returns council, region, localCarbon (gCO₂/kWh), ward.
 * No auth; used by Zone dashboard to show "Local" tag and Local Pulse badge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLocalData } from '@/lib/local/getLocalData'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCAL_INTEL_MAX_PER_MINUTE = 30

export async function GET(req: NextRequest) {
  const id = getClientIdentifier(req)
  const { ok, retryAfter } = checkRateLimit(`local-intel:${id}`, LOCAL_INTEL_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined })
  }

  const postcode = req.nextUrl.searchParams.get('postcode')?.trim()
  if (!postcode) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  if (postcode.length > 12) {
    return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
  }
  const data = await getLocalData(postcode)
  if (!data) {
    return NextResponse.json({ error: 'Could not resolve postcode' }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const id = getClientIdentifier(req)
  const { ok, retryAfter } = checkRateLimit(`local-intel:${id}`, LOCAL_INTEL_MAX_PER_MINUTE)
  if (!ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined })
  }

  const body = await req.json().catch(() => ({}))
  const postcode = typeof body?.postcode === 'string' ? body.postcode.trim() : ''
  if (!postcode) {
    return NextResponse.json({ error: 'postcode required' }, { status: 400 })
  }
  if (postcode.length > 12) {
    return NextResponse.json({ error: 'postcode too long' }, { status: 400 })
  }
  const data = await getLocalData(postcode)
  if (!data) {
    return NextResponse.json({ error: 'Could not resolve postcode' }, { status: 404 })
  }
  return NextResponse.json(data)
}
