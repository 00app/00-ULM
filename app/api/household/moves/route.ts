import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/requestAuth'
import { isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { createHouseholdMove, getLatestHouseholdMove } from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Settings → Living → Moving. GET the signed-in user's most recent move (null if none, never a
 * 401 — guests and users who haven't started one just see the "moving?" form). POST starts one.
 */
export async function GET() {
  const session = await getSessionFromRequest()
  const move = await getLatestHouseholdMove(session?.userId)
  return NextResponse.json({ signedIn: Boolean(session), move })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest()
  if (!session?.userId) return unauthorizedResponse()

  let body: { to_postcode?: string; from_postcode?: string; move_date?: string } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const toPostcode = body?.to_postcode?.trim() ?? ''
  if (!isValidUkPostcode(toPostcode)) {
    return NextResponse.json({ error: 'Enter a valid UK postcode' }, { status: 400 })
  }

  const move = await createHouseholdMove(session.userId, {
    to_postcode: toPostcode,
    from_postcode: body?.from_postcode?.trim() || null,
    move_date: body?.move_date || null,
  })
  if (!move) return NextResponse.json({ error: 'Could not save the move' }, { status: 500 })
  return NextResponse.json({ move })
}
