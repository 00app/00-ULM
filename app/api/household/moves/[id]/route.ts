import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/requestAuth'
import { isHouseholdCategory, isMoveChecklistStatus } from '@/lib/household/categories'
import { getHouseholdMoveById, updateHouseholdMoveChecklist } from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Settings → Living → Moving: set one category's status on the signed-in user's move.
 * Body: { category, status }. Reads the current checklist first and merges in just that one
 * entry — household_moves.checklist_jsonb has no per-key update, only whole-object replace.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest()
  if (!session?.userId) return unauthorizedResponse()

  const { id } = await params
  let body: { category?: string; status?: string } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || !isHouseholdCategory(body.category) || !isMoveChecklistStatus(body.status)) {
    return NextResponse.json({ error: 'A valid category and status are required' }, { status: 400 })
  }

  const existing = await getHouseholdMoveById(session.userId, id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const checklist = { ...existing.checklist_jsonb, [body.category]: body.status }
  const updated = await updateHouseholdMoveChecklist(session.userId, id, checklist)
  if (!updated) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ move: updated })
}
