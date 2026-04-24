/**
 * SSO activity visibility: archive (hide) action.
 * POST: mark activity as archived. Requires session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { executeSsoActivityAction } from '@/app/api/sso/activity/actions'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { activityId } = await context.params
    if (!activityId?.trim()) {
      return NextResponse.json({ error: 'Missing activityId' }, { status: 400 })
    }
    const result = await executeSsoActivityAction(activityId.trim(), 'archive', session.userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Archive visibility error:', error)
    return NextResponse.json(
      { error: 'Failed to archive' },
      { status: 500 }
    )
  }
}
