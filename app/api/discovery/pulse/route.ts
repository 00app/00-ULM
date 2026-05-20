/**
 * Discovery Pulse — economy fingerprint + recomputed £/kg for discovery injection ids (constants-only maths).
 * Optional Gemini status line (does not alter numeric truth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEconomyFingerprint } from '@/lib/brains/economyFingerprint'
import { PRICE_CAP_SAVING_APRIL_1 } from '@/lib/brains/constants'
import { parseDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import { isValidJourneyQuestion } from '@/lib/journeys'
import type { JourneyId } from '@/lib/journeys'
import { estimateDiscoveryCarbonKg, ukAverageSavingForDiscoveryAnswer } from '@/lib/brains/calculations'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function geminiPulseNote(): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return null
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 80 },
    })
    const prompt = `UK household energy app (March 2026). Official baselines in code: Boiler Upgrade Scheme up to £7500, typical price cap saving from April 1 ≈ £${PRICE_CAP_SAVING_APRIL_1}/yr. Reply with ONE short lowercase sentence (max 18 words) acknowledging grants/caps can change when policy updates — or the word "steady" if nothing to add. No JSON, no numbers beyond what you were given.`
    const t = (await model.generateContent(prompt)).response.text().trim().slice(0, 200)
    return t || null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawIds = Array.isArray(body?.injectionIds) ? body.injectionIds : []
    const injectionIds = rawIds.filter((x: unknown): x is string => typeof x === 'string')

    const fingerprint = getEconomyFingerprint()
    const patches: Record<string, { money: string; carbon: string }> = {}

    for (const id of injectionIds) {
      const parsed = parseDiscoveryInjectionId(id)
      if (!parsed) continue
      const { journeyId, questionId, answerValue } = parsed
      if (!isValidJourneyQuestion(journeyId, questionId)) continue
      const sav = ukAverageSavingForDiscoveryAnswer(journeyId as JourneyId, questionId, answerValue)
      const kg = estimateDiscoveryCarbonKg(journeyId as JourneyId, questionId, answerValue)
      patches[id] = {
        money: formatZoneCardMoney(sav.gbp),
        carbon: formatCarbon(kg),
      }
    }

    const geminiPulseNoteText = await geminiPulseNote()

    const out: import('@/lib/agents/heartbeat').DiscoveryPulseResult = {
      fingerprint,
      patches,
      geminiPulseNote: geminiPulseNoteText,
    }
    return NextResponse.json(out)
  } catch (e) {
    console.error('[discovery/pulse]', e)
    return NextResponse.json({ error: 'pulse failed' }, { status: 500 })
  }
}
