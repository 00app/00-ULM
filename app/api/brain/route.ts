/**
 * Brain API — unified Local + Global layers for Summary/Zone.
 * GET ?postcode=KW1&personalCarbon=3500&personalMoney=2200
 * Returns: { local: { council, region, localCarbonG, ... }, global: { ukAvgMoney, ukAvgCarbon, equivalentTrees? }, ready }
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { runBrain } from '@/lib/brain/runBrain'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

const BRAIN_MAX_PER_MINUTE = 30

export async function GET(req: NextRequest) {
  const id = getClientIdentifier(req)
  const { ok, retryAfter } = checkRateLimit(`brain:${id}`, BRAIN_MAX_PER_MINUTE)
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

  const personalCarbon = req.nextUrl.searchParams.get('personalCarbon')
  const personalMoney = req.nextUrl.searchParams.get('personalMoney')

  const personalCarbonKg = personalCarbon != null ? Number(personalCarbon) : undefined
  const personalMoneyGbp = personalMoney != null ? Number(personalMoney) : undefined

  try {
    const payload = await runBrain({
      postcode,
      personalCarbonKg: Number.isFinite(personalCarbonKg) ? personalCarbonKg : undefined,
      personalMoneyGbp: Number.isFinite(personalMoneyGbp) ? personalMoneyGbp : undefined,
    })
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: 'Brain failed', details: String(e) },
      { status: 500 }
    )
  }
}
