import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { countHouseholdAccountsByGroup } from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Settings → Living: active household account count per group for the signed-in user.
 * Guests get all-zero counts (household data is signed-in only), never a 401, so the
 * Settings cards can render "Not set up yet" without special-casing.
 */
export async function GET() {
  const session = await getSessionFromRequest()
  const counts = await countHouseholdAccountsByGroup(session?.userId)
  return NextResponse.json({ signedIn: Boolean(session), counts })
}
