'use client'

import type { JourneyId } from '@/lib/journeys'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'
import {
  persistUnifiedUserProfileMemory,
  UNIFIED_PROFILE_MEMORY_KEY,
  type UnifiedProfileMemory,
} from '@/lib/unifiedProfileMemory'
import { buildSoloFocusBestOfferHint } from '@/lib/soloFocusBestOfferHint'
import { triggerScrapeSyncForCategory } from '@/lib/researchSyncClient'
import type { MemoryFlushPayload } from '@/lib/memory/userContext'

async function flushMemoryBridgeFromUnifiedStorage(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(UNIFIED_PROFILE_MEMORY_KEY)
    if (!raw) return
    const snap = JSON.parse(raw) as UnifiedProfileMemory
    const profile = snap.profile ?? {}
    const payload: MemoryFlushPayload = {
      profile: {
        name: profile.name || undefined,
        postcode: profile.postcode || undefined,
        household: profile.household || undefined,
        home_type: profile.home_type || undefined,
        transport_baseline: profile.transport || undefined,
        age: profile.age || undefined,
        employment_status: profile.employment_status || undefined,
        goal: profile.goal || undefined,
      },
      journeyAnswers: snap.journeyAnswers ?? ({} as Record<JourneyId, Record<string, string>>),
    }
    await fetch('/api/memory/flush', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    /* offline / guest */
  }
}

/** Final-audit beat: local unified memory + Zai bridge + Neon genome / user_profiles + best-offer scrape pulse. */
export function runSoloFocusAuditCompletionClient(opts: {
  journeyId: JourneyId | undefined | null
  questionId: string
  answerValue: string
  postcode: string | null | undefined
  profileData: ResearchProfileData | null | undefined
  journeyAnswers: Record<string, Record<string, string>> | null | undefined
}): void {
  persistUnifiedUserProfileMemory()
  void flushMemoryBridgeFromUnifiedStorage()

  const hint = buildSoloFocusBestOfferHint({
    journeyId: opts.journeyId ?? undefined,
    questionId: opts.questionId,
    answerValue: opts.answerValue,
    journeyAnswers: opts.journeyAnswers ?? undefined,
  })
  const jid = opts.journeyId
  if (jid) {
    triggerScrapeSyncForCategory({
      postcode: opts.postcode,
      category: jid,
      profileData: opts.profileData ?? undefined,
      bestOfferHint: hint,
    })
  }

  void fetch('/api/solo-focus/audit-complete', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      journeyId: jid ?? null,
      lastQuestionId: opts.questionId,
      lastAnswerValue: opts.answerValue,
      journeyAnswers: opts.journeyAnswers ?? {},
    }),
  }).catch(() => {})
}
