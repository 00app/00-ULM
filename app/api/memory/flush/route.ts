import { NextRequest, NextResponse } from 'next/server'
import { buildUserContextMarkdown, type MemoryFlushPayload } from '@/lib/memory/userContext'
import { setUserContextMarkdown } from '@/lib/memory/store'
import type { JourneyId } from '@/lib/journeys'
import { requireAiRouteAuth } from '@/lib/requestAuth'
import { invalidBodyResponse, memoryFlushPostBodySchema } from '@/lib/api/schemas'

export const dynamic = 'force-dynamic'

/**
 * Flush user context from Profile + Journey Answers into the memory bridge.
 * Zai reads this for personalised search and advice.
 * Call after Profile completion and when contextual answers update in Expanded View.
 */
export async function POST(request: NextRequest) {
  try {
    const authDenied = await requireAiRouteAuth(request)
    if (authDenied) return authDenied

    const rawBody = await request.json().catch(() => ({}))
    const parsed = memoryFlushPostBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return invalidBodyResponse(parsed.error)
    }
    const body = parsed.data
    const payload: MemoryFlushPayload = {
      profile: body.profile,
      journeyAnswers: (body.journeyAnswers ?? {}) as Record<JourneyId, Record<string, string>>,
      activeGoals: body.activeGoals,
      contextUpdate: body.contextUpdate,
    }
    const markdown = buildUserContextMarkdown(payload)
    setUserContextMarkdown(markdown)
    return NextResponse.json({ ok: true, length: markdown.length })
  } catch (e) {
    console.error('[memory/flush]', e)
    return NextResponse.json({ ok: false, error: 'Failed to flush memory' }, { status: 500 })
  }
}
