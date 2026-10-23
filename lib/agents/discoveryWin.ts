/**
 * Solo Focus “Win” line — same policy as Zai mandatory opener (Gemini + deterministic fallback).
 * Used by POST /api/zai (mode discovery_win) and POST /api/answers (discovery_win field).
 */

import type { JourneyId } from '@/lib/journeys'
import { MARCH_2026_ECONOMY, TYPICAL_ANNUAL_CAP } from '@/lib/brains/constants'
import { isBucketFailoverMode, shouldSkipGeminiInBucket } from '@/lib/intelligence/scrapeBoundaries'
import { generateGatewayText, hasAnyBucketLlmProvider, isBucketFailoverEnabled } from '@/lib/intelligence/aiGateway'

function heatingLower(ja: Record<string, Record<string, string>>): string {
  return (ja.home?.energy_type ?? ja.home?.heating ?? '').toString().trim().toLowerCase()
}

/** Deterministic one-sentence win (lowercase brand voice). */
export function deterministicDiscoveryWin(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  journeyAnswers: Record<string, Record<string, string>>
  postcode: string | null
}): string {
  const { journeyId, questionId, answerValue, journeyAnswers, postcode } = params
  const raw = answerValue.trim().toLowerCase()
  const pc = postcode?.replace(/\s+/g, '').trim().toUpperCase() ?? ''
  const heat = heatingLower(journeyAnswers)

  if (
    ((journeyId === 'home' && questionId === 'energy_type') ||
      (journeyId === 'utilities' && questionId === 'home_power')) &&
    raw === 'gas'
  ) {
    return `since you have gas, you're eligible for up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()} toward a heat pump via the boiler upgrade scheme, and a fixed tariff priced under the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december) is the quickest bill win.`
  }
  if (journeyId === 'home' && heat === 'gas') {
    return `since you have gas heating, you're in the sweet spot for the £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()} heat pump grant, and worth checking your tariff against the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december).`
  }
  if (pc && heat) {
    return `since you have ${heat} and you're in ${pc}, you should stack local grants and compare fixed tariffs against the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december) before you lock in.`
  }
  if (heat) {
    return `since you have ${heat}, you should line up 2026 grants and check your tariff against the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december) before big kit purchases.`
  }
  if (pc) {
    return `since you're in ${pc}, you should check council warm homes grants and compare your tariff against the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december).`
  }
  return `you're lined up for 2026 uk savings: start by checking your tariff against the current cap (£${TYPICAL_ANNUAL_CAP.toLocaleString('en-GB')} typical a year to 31 december), then layer grants that match your profile.`
}

export async function generateDiscoveryWinWithGemini(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  journeyAnswers: Record<string, Record<string, string>>
  postcode: string | null
}): Promise<string> {
  const fallback = deterministicDiscoveryWin(params)
  if (shouldSkipGeminiInBucket() && isBucketFailoverEnabled()) {
    if (!hasAnyBucketLlmProvider()) return fallback
    try {
      const ctx = JSON.stringify({
        journey: params.journeyId,
        question: params.questionId,
        answer: params.answerValue,
        postcode: params.postcode,
        home: params.journeyAnswers.home ?? {},
      }).slice(0, 800)
      const prompt = `You write ONE sentence for a UK savings app (October 2026). Lowercase. Witty but clinical.
Must start with "since you have" (heating/answer) OR "since you're in" (postcode) when that data exists in the JSON.
Mention real 2026 facts only: Boiler Upgrade up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP}, current Ofgem cap £${TYPICAL_ANNUAL_CAP} typical a year (1 Oct to 31 Dec 2026). Never claim the cap is falling. No markdown, max 220 chars.

Context JSON: ${ctx}`
      const { text } = await generateGatewayText({
        prompt,
        tag: 'discovery-win',
        tier: 'chat',
        maxOutputTokens: 120,
        temperature: 0.2,
      })
      const trimmed = text?.trim().replace(/\s+/g, ' ').slice(0, 240)
      if (!trimmed || trimmed.length < 12) return fallback
      return trimmed.toLowerCase()
    } catch {
      return fallback
    }
  }

  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return fallback

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-1.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
    })
    const ctx = JSON.stringify({
      journey: params.journeyId,
      question: params.questionId,
      answer: params.answerValue,
      postcode: params.postcode,
      home: params.journeyAnswers.home ?? {},
    }).slice(0, 800)

    const prompt = `You write ONE sentence for a UK savings app (October 2026). Lowercase. Witty but clinical.
Must start with "since you have" (heating/answer) OR "since you're in" (postcode) when that data exists in the JSON.
Mention real 2026 facts only: Boiler Upgrade up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP}, current Ofgem cap £${TYPICAL_ANNUAL_CAP} typical a year (1 Oct to 31 Dec 2026). Never claim the cap is falling. No markdown, max 220 chars.

Context JSON: ${ctx}`

    const text = (await model.generateContent(prompt)).response.text().trim().replace(/\s+/g, ' ').slice(0, 240)
    if (!text || text.length < 12) return fallback
    return text.toLowerCase()
  } catch {
    return fallback
  }
}
