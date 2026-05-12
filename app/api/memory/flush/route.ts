import { NextRequest, NextResponse } from 'next/server'
import { buildUserContextMarkdown, type MemoryFlushPayload } from '@/lib/memory/userContext'
import { setUserContextMarkdown } from '@/lib/memory/store'
import type { JourneyId } from '@/lib/journeys'

export const dynamic = 'force-dynamic'

/**
 * Flush user context from Profile + Journey Answers into the memory bridge.
 * OpenClaw and Zai read this for personalised search and advice.
 * Call after Profile completion and when contextual answers update in Expanded View.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MemoryFlushPayload
    const { profile, journeyAnswers, activeGoals } = body
    const payload: MemoryFlushPayload = {
      profile,
      journeyAnswers: journeyAnswers ?? ({} as Record<JourneyId, Record<string, string>>),
      activeGoals,
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
