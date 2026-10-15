import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/requestAuth'
import { endHouseholdAccount } from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Settings → Living: end (soft-delete) one account the signed-in user owns. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest()
  if (!session?.userId) return unauthorizedResponse()

  const { id } = await params
  const ended = await endHouseholdAccount(session.userId, id)
  if (!ended) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
