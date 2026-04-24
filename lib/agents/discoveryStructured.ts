/**
 * Discovery Loop — ZeroResearch (OpenClaw) + Gemini 2.0 Flash structured JSON for /api/answers.
 */

import type { JourneyId } from '@/lib/journeys'
import { triggerSupplementalResearch, type ResearchProfileData } from '@/lib/agents/researchAgent'
import { validateInjectionCard } from '@/lib/zone/injections'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'
import { buildDiscoveryInjectionCardAsync, buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import { enforceTrueWinRails, TRUE_WIN_RAILS } from '@/lib/zone/trueWinRails'

export interface DiscoveryStructuredResponse {
  recommendation_copy: string
  source_url: string
  new_card_data: ZoneTipCard
}

function sanitizeHttpsUrl(u: string, fallback: string): string {
  try {
    const x = new URL(u.trim())
    if (x.protocol !== 'https:') return fallback
    return x.href
  } catch {
    return fallback
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    const o = JSON.parse(t) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * After DB commit: run ZeroResearch agent, then Gemini JSON (recommendation_copy, source_url, new_card_data).
 * Falls back to deterministic discovery card when Gemini or OpenClaw is unavailable.
 */
export async function runDiscoveryStructuredPipeline(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null
  profileData: ResearchProfileData | null
}): Promise<DiscoveryStructuredResponse | null> {
  const { journeyId, questionId, answerValue, postcode, profileData } = params

  const researchBlock = await Promise.race([
    triggerSupplementalResearch({
      postcode: postcode ?? undefined,
      profileData: profileData ?? undefined,
      persistToNeon: true,
    }),
    new Promise<null>((r) => setTimeout(() => r(null), 4500)),
  ])
  const researchMd = researchBlock?.markdown?.slice(0, 4000) ?? ''

  const stableId = buildDiscoveryInjectionId(journeyId, questionId, answerValue)
  const fallbackCard = await buildDiscoveryInjectionCardAsync(journeyId, questionId, answerValue, stableId)
  if (!fallbackCard) return null
  const defaultSource = sanitizeHttpsUrl(
    fallbackCard.cta?.url ?? fallbackCard.source ?? 'https://www.gov.uk/',
    'https://www.gov.uk/'
  )
  const defaultCopy =
    (fallbackCard.explanation?.[0] ?? '').slice(0, 500) ||
    'check gov.uk and energy saving trust for 2026 grants and tariffs that match your answer.'

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      recommendation_copy: defaultCopy,
      source_url: defaultSource,
      new_card_data: fallbackCard,
    }
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
      },
    })

    const prompt = `You are Zai, the Zero Zero UK savings engine (production March 2026). Output ONE JSON object only.

User: journey="${journeyId}", question="${questionId}", answer="${answerValue}", postcode="${postcode ?? 'unknown'}".

ZeroResearch / OpenClaw context (may be partial):
---
${researchMd || '(no research block yet)'}
---

Required JSON shape:
{
  "recommendation_copy": "string, max 400 chars, lowercase, witty, specific UK financial advice tied to the answer in Zai persona; mention real schemes only (Boiler Upgrade Scheme up to £7500, Ofgem price cap, EV chargepoint grant, etc.) when relevant.",
  "source_url": "https URL, prefer gov.uk or energysavingtrust.org.uk",
  "new_card_data": {
    "id": "${stableId}",
    "title": "SHORT HEADLINE 6 WORDS MAX UPPERCASE STYLE",
    "journey_key": "${journeyId}",
    "data": { "money": "string like £7.5k or £500", "carbon": "string like 640 kg CO₂" },
    "dominant_win": "money or carbon",
    "explanation": ["one line"],
    "actions": { "actionType": "learn", "learnUrl": "https...", "actionUrl": "https..." },
    "cta": { "label": "string", "url": "https..." },
    "followUp": { "question": "string", "options": ["YES","NO","PARTIAL"], "targetField": "home_insulation_level" }
  }
}

Optional followUp: include for gas/heating paths (nested loop — insulation, tariff, parking, etc.). Use journey_key exactly "${journeyId}". Set new_card_data.id exactly to "${stableId}". If live data is ambiguous, fall back to March 2026 rails (£${TRUE_WIN_RAILS.energyCapGbp} cap, ${TRUE_WIN_RAILS.avgTariffPencePerKwh}p/kWh tariff). No markdown, no extra keys beyond followUp inside new_card_data.`

    const result = await model.generateContent(prompt)
    const rawText = result.response.text()
    const parsed = parseJsonObject(rawText)
    if (!parsed) throw new Error('gemini json parse')

    const recommendation_copy =
      typeof parsed.recommendation_copy === 'string'
        ? parsed.recommendation_copy.trim().slice(0, 500)
        : defaultCopy
    const source_url = sanitizeHttpsUrl(
      typeof parsed.source_url === 'string' ? parsed.source_url : defaultSource,
      defaultSource
    )

    const mergedRaw = {
      ...(parsed.new_card_data && typeof parsed.new_card_data === 'object'
        ? (parsed.new_card_data as Record<string, unknown>)
        : {}),
      id: stableId,
      journey_key: journeyId,
      category: journeyId,
    }

    let card = validateInjectionCard(mergedRaw)
    if (!card) {
      card = validateInjectionCard({
        id: stableId,
        title: fallbackCard.title,
        journey_key: journeyId,
        category: journeyId,
        data: fallbackCard.data,
        source: source_url,
        explanation: [recommendation_copy.slice(0, 280)],
        actions: fallbackCard.actions,
        cta: fallbackCard.cta ?? { label: 'Get this Saving', url: source_url },
      })
    }
    if (!card) {
      return {
        recommendation_copy: defaultCopy,
        source_url: defaultSource,
        new_card_data: enforceTrueWinRails(fallbackCard),
      }
    }

    card = enforceTrueWinRails({
      ...card,
      id: stableId,
      explanation: card.explanation?.length
        ? [recommendation_copy || card.explanation[0]]
        : [recommendation_copy],
    })

    if (fallbackCard.followUp && !card.followUp) {
      const withTrap = validateInjectionCard({ ...card, followUp: fallbackCard.followUp })
      if (withTrap) card = withTrap
    }

    return {
      recommendation_copy: recommendation_copy || defaultCopy,
      source_url,
      new_card_data: enforceTrueWinRails(card),
    }
  } catch (e) {
    console.warn('[discoveryStructured] Gemini pipeline:', e)
    return {
      recommendation_copy: defaultCopy,
      source_url: defaultSource,
      new_card_data: enforceTrueWinRails(fallbackCard),
    }
  }
}
