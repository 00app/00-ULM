/**
 * Solo Focus — final embedded-journey audit: persist genome handshake + optional `user_profiles` mirror.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { mergeUserGenomeSoloFocusAudit } from '@/lib/db/neon'
import { mirrorJourneyAnswersToUserProfilesIfAvailable } from '@/lib/db/userProfilesMirror'
import {
  finalizeAuthenticatedResponse,
  resolveAuthenticatedUser,
} from '@/lib/auth/resolveAuthenticatedUser'

export const dynamic = 'force-dynamic'

function sanitizeJourneyAnswers(raw: unknown): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const jid of JOURNEY_ORDER) {
    const slice = (raw as Record<string, unknown>)[jid]
    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) continue
    const inner: Record<string, string> = {}
    for (const [k, v] of Object.entries(slice as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) inner[k.slice(0, 96)] = v.trim().slice(0, 700)
    }
    out[jid] = inner
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const bodyObj = body && typeof body === 'object' ? body : {}
    const auth = await resolveAuthenticatedUser(request, bodyObj)
    const userId = auth?.userId?.trim()
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const journeyIdRaw = typeof bodyObj.journeyId === 'string' ? bodyObj.journeyId.trim().toLowerCase() : ''
    const journeyId = JOURNEY_ORDER.includes(journeyIdRaw as JourneyId) ? journeyIdRaw : null
    const lastQ = typeof bodyObj.lastQuestionId === 'string' ? bodyObj.lastQuestionId.trim().slice(0, 96) : ''
    const lastA = typeof bodyObj.lastAnswerValue === 'string' ? bodyObj.lastAnswerValue.trim().slice(0, 700) : ''

    await mergeUserGenomeSoloFocusAudit(userId, {
      journeyId,
      lastQuestionId: lastQ || null,
      lastAnswer: lastA || null,
    })

    const ja = sanitizeJourneyAnswers(bodyObj.journeyAnswers ?? {})
    const mirrored = await mirrorJourneyAnswersToUserProfilesIfAvailable(userId, ja)

    const res = NextResponse.json({ ok: true, user_profiles_mirror: mirrored })
    if (auth) return finalizeAuthenticatedResponse(res, auth)
    return res
  } catch (e) {
    console.error('[solo-focus/audit-complete]', e)
    return NextResponse.json({ ok: false, error: 'audit_complete_failed' }, { status: 500 })
  }
}
