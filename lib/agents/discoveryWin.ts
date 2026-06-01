/**
 * Solo Focus “Win” line — same policy as Zai mandatory opener (Gemini + deterministic fallback).
 * Used by POST /api/zai (mode discovery_win) and POST /api/answers (discovery_win field).
 */

import type { JourneyId } from '@/lib/journeys'
import { MARCH_2026_ECONOMY, PRICE_CAP_SAVING_APRIL_1 } from '@/lib/brains/constants'
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
    return `since you have gas, you're eligible for up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()} toward a heat pump via the boiler upgrade scheme — and the april price cap shift saves a typical home ~£${PRICE_CAP_SAVING_APRIL_1}/yr.`
  }
  if (journeyId === 'home' && heat === 'gas') {
    return `since you have gas heating, you're in the sweet spot for the £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP.toLocaleString()} heat pump grant and the ~£${PRICE_CAP_SAVING_APRIL_1}/yr typical saving when the cap drops 1 april.`
  }
  if (pc && heat) {
    return `since you have ${heat} and you're in ${pc}, you should stack local grants with the april cap move (~£${PRICE_CAP_SAVING_APRIL_1}/yr typical) before you lock in a tariff.`
  }
  if (heat) {
    return `since you have ${heat}, you should line up 2026 grants and the april cap dip (~£${PRICE_CAP_SAVING_APRIL_1}/yr typical) before big kit purchases.`
  }
  if (pc) {
    return `since you're in ${pc}, you should check council warm homes and the april cap saving (~£${PRICE_CAP_SAVING_APRIL_1}/yr typical) on typical use.`
  }
  return `you're lined up for 2026 uk savings — start with the april cap dip (~£${PRICE_CAP_SAVING_APRIL_1}/yr typical) then layer grants that match your profile.`
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
      const prompt = `You write ONE sentence for a UK savings app (March 2026). Lowercase. Witty but clinical.
Must start with "since you have" (heating/answer) OR "since you're in" (postcode) when that data exists in the JSON.
Mention real 2026 facts only: Boiler Upgrade up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP}, April cap typical saving ~£${PRICE_CAP_SAVING_APRIL_1}/yr. No markdown, max 220 chars.

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

    const prompt = `You write ONE sentence for a UK savings app (March 2026). Lowercase. Witty but clinical.
Must start with "since you have" (heating/answer) OR "since you're in" (postcode) when that data exists in the JSON.
Mention real 2026 facts only: Boiler Upgrade up to £${MARCH_2026_ECONOMY.BUS_GRANT_HEAT_PUMP}, April cap typical saving ~£${PRICE_CAP_SAVING_APRIL_1}/yr. No markdown, max 220 chars.

Context JSON: ${ctx}`

    const text = (await model.generateContent(prompt)).response.text().trim().replace(/\s+/g, ' ').slice(0, 240)
    if (!text || text.length < 12) return fallback
    return text.toLowerCase()
  } catch {
    return fallback
  }
}
