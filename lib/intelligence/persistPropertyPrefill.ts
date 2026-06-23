/**
 * Server-side property prefill — persist answers + genome metadata after signup.
 */

import type { JourneyId } from '@/lib/journeys'
import { upsertUserAnswers } from '@/lib/db/neon'
import pool from '@/lib/db'
import { runLoopSpawnResearch } from '@/lib/zone/loopSpawnResearch'
import {
  buildPropertyAnswerPrefill,
  type PropertyPrefillResult,
} from '@/lib/intelligence/propertyAnswerPrefill'
import type { PropertyIntelligence } from '@/lib/intelligence/propertyIntelligenceTypes'
import type { ResearchProfileData } from '@/lib/agents/researchAgent'

export async function persistPropertyPrefillForUser(params: {
  userId: string
  postcode: string
  propertyIntelligence: PropertyIntelligence
  profileData?: ResearchProfileData | null
}): Promise<PropertyPrefillResult> {
  const prefill = buildPropertyAnswerPrefill(params.propertyIntelligence)
  if (Object.keys(prefill.answers).length === 0 && !prefill.home_power) {
    return prefill
  }

  if (Object.keys(prefill.answers).length > 0) {
    await upsertUserAnswers(params.userId, prefill.answers as Record<string, Record<string, string>>)
  }

  const uid = params.userId.trim()
  const genomePatch: Record<string, unknown> = {
    property_answer_sources: prefill.sources,
    property_data_injected_at: new Date().toISOString(),
  }
  if (prefill.home_power) {
    genomePatch.home_power = prefill.home_power
  }

  try {
    await pool.query(
      `UPDATE users
       SET user_genome = COALESCE(user_genome, '{}'::jsonb) || $2::jsonb
       WHERE id = $1::uuid`,
      [uid, JSON.stringify(genomePatch)]
    )
  } catch {
    /* non-blocking */
  }

  const pc = params.postcode.replace(/\s+/g, '').trim()
  for (const [journeyId, qMap] of Object.entries(prefill.answers)) {
    if (!qMap || typeof qMap !== 'object') continue
    for (const [questionId, answerValue] of Object.entries(qMap)) {
      void runLoopSpawnResearch({
        userId: uid,
        postcode: pc,
        journeyId: journeyId as JourneyId,
        questionId,
        answerValue: String(answerValue),
        profileData: {
          ...(params.profileData ?? {}),
          postcode: pc,
          home_power: prefill.home_power ?? params.profileData?.home_power,
        },
      })
    }
  }

  return prefill
}
