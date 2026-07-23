/**
 * Discovery Engine — build validated Zone tip cards after each journey answer.
 * Optional Gemini headline; deterministic money/carbon from March 2026 calculators.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'
import { formatCarbon, formatZoneCardMoney } from '@/lib/format'
import {
  estimateDiscoveryCarbonKg,
  ukAverageSavingForDiscoveryAnswer,
} from '@/lib/brains/calculations'
import { getDiscoveryRecommendation } from '@/lib/brains/recommendations'
import { validateInjectionCard } from '@/lib/zone/injections'
import { clampZoneBentoHeadline } from '@/lib/soloFocusCopy'
import { decodeUtf8Base64Url, encodeUtf8Base64Url } from '@/lib/zone/base64url'
import { shouldSkipGeminiInBucket } from '@/lib/intelligence/scrapeBoundaries'
import { offerProviderFromHandoffUrl } from '@/lib/soloFocusSuppliedBy'

/** Reversible token for answer text (pulse can decode back to full option string). */
function discoveryAnswerToken(answerValue: string): string {
  const encoded = encodeUtf8Base64Url(answerValue, 36)
  if (encoded) return encoded
  const t = answerValue.trim()
  return t.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 20).toUpperCase() || 'ANS'
}

export function decodeDiscoveryAnswerToken(token: string): string {
  const decoded = decodeUtf8Base64Url(token)
  return decoded || token
}

/** djb2 — deterministic positive integer from a string (no crypto import needed client-side). */
function deterministicDigitsFrom(s: string): string {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0
  }
  return String(Math.abs(hash))
}

/**
 * Stable id for pulse recompute: inject-{journey}__{questionId}__{token}__{digest}.
 *
 * Every caller of this function names its result `stableId` / `id` expecting the SAME
 * (journeyId, questionId, answerValue) triplet to always resolve to the SAME card id — that's
 * how DiscoveryTakeover's optimistic-then-tier2-enriched birth sequence is meant to *replace*
 * one card in place rather than add a second one, and how `parseDiscoveryInjectionId` round-trips
 * an id back to its triplet. A `Date.now()` suffix here broke that contract: two births for the
 * same answer, seconds apart, produced two different ids — the "wall ends up with a duplicate
 * category card" bug. A deterministic digest of the triplet keeps ids reversible-and-unique per
 * answer while actually being stable across repeat calls.
 */
export function buildDiscoveryInjectionId(
  journeyId: JourneyId,
  questionId: string,
  answerValue: string
): string {
  const token = discoveryAnswerToken(answerValue)
  const digest = deterministicDigitsFrom(`${journeyId}__${questionId}__${answerValue}`)
  return `inject-${journeyId}__${questionId}__${token}__${digest}`
}

/** Parse ids from {@link buildDiscoveryInjectionId}; returns null if unknown shape. */
export function parseDiscoveryInjectionId(id: string): {
  journeyId: JourneyId
  questionId: string
  answerValue: string
} | null {
  if (!id.startsWith('inject-')) return null
  const body = id.slice('inject-'.length)
  const parts = body.split('__')
  if (parts.length < 4) return null
  const ts = parts[parts.length - 1]
  if (!/^\d+$/.test(ts)) return null
  const token = parts[parts.length - 2] ?? ''
  const journeyId = parts[0] as JourneyId
  const questionId = parts.slice(1, -2).join('__')
  if (!journeyId || !questionId || !token) return null
  if (!JOURNEY_IDS.includes(journeyId)) return null
  return { journeyId, questionId, answerValue: decodeDiscoveryAnswerToken(token) }
}

async function geminiDiscoveryHeadline(context: string, fallback: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key || shouldSkipGeminiInBucket()) return fallback
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash',
    })
    const prompt = `You name UK sustainability savings cards. Return ONE headline only: max 6 words, SCREAMING SNAKE style with spaces (e.g. EV CHARGEPOINT SAVING). No quotes. Context: ${context}`
    const result = await model.generateContent(prompt)
    const text = result.response
      .text()
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 72)
    return text || fallback
  } catch {
    return fallback
  }
}

/**
 * Build a single injection card (Zone grid). Returns null if invalid after validation.
 */
export async function buildDiscoveryInjectionCardAsync(
  journeyId: JourneyId,
  questionId: string,
  answerValue: string,
  forcedId?: string,
  userCtx?: { postcode?: string | null; tenure?: string | null }
): Promise<ReturnType<typeof validateInjectionCard>> {
  const rec = getDiscoveryRecommendation(journeyId, questionId, answerValue, userCtx)
  const saving = ukAverageSavingForDiscoveryAnswer(journeyId, questionId, answerValue)
  const carbonKg = estimateDiscoveryCarbonKg(journeyId, questionId, answerValue)
  const id = forcedId ?? buildDiscoveryInjectionId(journeyId, questionId, answerValue)

  const ctx = `journey=${journeyId} question=${questionId} answer=${answerValue} benchmark £${saving.gbp}`
  const geminiTitle = await geminiDiscoveryHeadline(ctx, rec.headline)
  const title = clampZoneBentoHeadline(geminiTitle || rec.headline, rec.gridJourneyKey)

  const raw = {
    id,
    title,
    journey_key: rec.gridJourneyKey,
    category: rec.gridJourneyKey,
    data: {
      money: formatZoneCardMoney(saving.gbp),
      carbon: formatCarbon(carbonKg),
    },
    source: rec.learnUrl,
    // "uk 2026 discovery" was this engine's own internal pipeline name — real, but reads like
    // a citation to a user, not the actual UK org behind the number. Name the real source the
    // learn link points at (gov.uk, Ofgem, Energy Saving Trust, ...) instead.
    sourceLabel: offerProviderFromHandoffUrl(rec.learnUrl) ?? 'UK Government Data',
    explanation: [rec.body],
    actions: {
      actionType: 'learn' as const,
      learnUrl: rec.learnUrl,
      actionUrl: rec.actionUrl ?? rec.ctaUrl,
    },
    cta: { label: rec.ctaLabel, url: rec.ctaUrl },
    ...(rec.followUp ? { followUp: rec.followUp } : {}),
  }

  return validateInjectionCard(raw)
}
