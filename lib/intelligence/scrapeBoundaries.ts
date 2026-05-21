/**
 * JIT scrape boundaries — category + profile only; no broad domain pulses.
 * Active when MODEL_STRATEGY=bucket_failover (use less, more).
 */

import type { JourneyId } from '@/lib/journeys'
import { resolveSurgicalJourneyKey } from '@/lib/intelligence/topicShield'

export function isBucketFailoverMode(): boolean {
  return process.env.MODEL_STRATEGY?.trim().toLowerCase() === 'bucket_failover'
}

/** Skip paid Gemini in the provider chain — use Groq / Mistral / OpenRouter only. */
export function shouldSkipGeminiInBucket(): boolean {
  const skip = process.env.BUCKET_SKIP_GEMINI?.trim().toLowerCase() ?? ''
  if (skip === '1' || skip === 'true' || skip === 'yes') return true
  const free = process.env.GEMINI_FREE_TIER?.trim().toLowerCase() ?? ''
  return free === '1' || free === 'true' || free === 'yes'
}

/** Broad multi-category Firecrawl+Gemini (GET ?force=true, cron full batch). Off by default in bucket mode. */
export function isBroadResearchAllowed(): boolean {
  if (!isBucketFailoverMode()) return true
  const v = process.env.ALLOW_BROAD_SCRAPE?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}

export function resolveMaxIterations(): number {
  const raw = process.env.MAX_ITERATIONS?.trim()
  const n = raw ? parseInt(raw, 10) : 5
  if (!Number.isFinite(n)) return 5
  return Math.min(12, Math.max(1, n))
}

/** Skip second-pass Gemini deep search when on bucket mode (Firecrawl surgical + triplet extraction only). */
export function shouldSkipDeepGeminiSearch(): boolean {
  if (isBucketFailoverMode()) return true
  const v = process.env.BUCKET_SKIP_DEEP_GEMINI?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}

export type SurgicalScrapeContext = {
  postcode: string
  journeyKey: string | null
  hasProfileAnchor: boolean
}

export function validateSurgicalScrapeContext(params: {
  postcode?: string | null
  journeyKey?: string | null
  category?: string | null
  profileData?: { postcode?: string | null } | null
}): { ok: true; ctx: SurgicalScrapeContext } | { ok: false; error: string } {
  const pc = String(params.postcode ?? params.profileData?.postcode ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
  if (pc.length < 4) {
    return { ok: false, error: 'postcode required (≥4 chars) — POSTCODE DNA is the primary coordinate' }
  }
  const journeyKey =
    resolveSurgicalJourneyKey(params.journeyKey) ??
    resolveSurgicalJourneyKey(params.category)
  if (!journeyKey) {
    return {
      ok: false,
      error: 'journey_key required — scrape one category at a time (Topic Shield / Lane Lock)',
    }
  }
  const hasProfileAnchor = Boolean(
    params.profileData?.postcode?.trim() ||
      params.profileData &&
        typeof params.profileData === 'object' &&
        Object.keys(params.profileData).some((k) => {
          const v = (params.profileData as Record<string, unknown>)[k]
          return v != null && String(v).trim() !== ''
        })
  )
  if (!hasProfileAnchor) {
    return { ok: false, error: 'profile anchor required — pass profileData or session profile for this postcode' }
  }
  return { ok: true, ctx: { postcode: pc, journeyKey, hasProfileAnchor } }
}

export function assertBroadResearchBlocked(action: string): { blocked: boolean; message: string } {
  if (isBroadResearchAllowed()) return { blocked: false, message: '' }
  return {
    blocked: true,
    message: `${action} disabled in bucket_failover mode. Use earned JIT scrape (journey_key + profile) or ?repair=1 / repair-mechanical. Set ALLOW_BROAD_SCRAPE=1 only for one-off audits.`,
  }
}

export function bucketFailoverStatus(): {
  enabled: boolean
  maxIterations: number
  broadScrapeAllowed: boolean
  skipDeepGemini: boolean
  providers: { gemini: boolean; groq: boolean; mistral: boolean; openrouter: boolean }
} {
  return {
    enabled: isBucketFailoverMode(),
    maxIterations: resolveMaxIterations(),
    broadScrapeAllowed: isBroadResearchAllowed(),
    skipDeepGemini: shouldSkipDeepGeminiSearch(),
    providers: {
      gemini:
        Boolean(process.env.GEMINI_API_KEY?.trim()) && !shouldSkipGeminiInBucket(),
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      mistral: Boolean(process.env.MISTRAL_API_KEY?.trim()),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    },
  }
}
