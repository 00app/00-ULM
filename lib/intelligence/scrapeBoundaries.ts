/**
 * JIT scrape boundaries — category + profile only; no broad domain pulses.
 * Active when MODEL_STRATEGY=bucket_failover (use less, more).
 */

import type { JourneyId } from '@/lib/journeys'
import { resolveSurgicalJourneyKey } from '@/lib/intelligence/topicShield'
import { resolveFirecrawlApiKey } from '@/lib/sentinel/api-config'

export function isBucketFailoverMode(): boolean {
  return process.env.MODEL_STRATEGY?.trim().toLowerCase() === 'bucket_failover'
}

/**
 * Master kill switch for all live LLM content generation (Gemini direct, Groq/Mistral/OpenRouter
 * bucket failover, and the Hermes cron sweep). OFF by default — the pivot to Claude-Code-driven,
 * county-level static content means the app can't rely on free-tier LLM quota. Set
 * LIVE_LLM_CONTENT_ENABLED=1 to reconnect once a paid tier funds it again. Nothing is deleted:
 * every caller of generateResearchText / runZeroAgent already falls through to the existing
 * mechanical/template fallback content when the LLM returns nothing, so disabling this flag just
 * means that fallback path fires every time instead of only on provider failure.
 */
export function isLiveLlmContentEnabled(): boolean {
  const v = process.env.LIVE_LLM_CONTENT_ENABLED?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
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

/** Skip Firecrawl HTTP (402 / no key / explicit opt-out) — use mechanical + Neon fallbacks. */
export function shouldSkipFirecrawlScrape(): boolean {
  const v = process.env.SKIP_FIRECRAWL?.trim().toLowerCase() ?? ''
  if (v === '1' || v === 'true' || v === 'yes') return true
  return resolveFirecrawlApiKey().length === 0
}

/** Skip second-pass Gemini deep search when on bucket mode (Firecrawl surgical + triplet extraction only). */
export function shouldSkipDeepGeminiSearch(): boolean {
  if (isBucketFailoverMode()) return true
  const v = process.env.BUCKET_SKIP_DEEP_GEMINI?.trim().toLowerCase() ?? ''
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Bucket mode: prefer mechanical triplets for JIT scrape-sync (no Groq TPM storm).
 * Set ALLOW_LLM_TRIPLET=1 to opt back into LLM extraction on triggers/repair.
 */
export function shouldPreferMechanicalTripletInBucket(): boolean {
  if (!isBucketFailoverMode()) return false
  const allow = process.env.ALLOW_LLM_TRIPLET?.trim().toLowerCase() ?? ''
  if (allow === '1' || allow === 'true' || allow === 'yes') return false
  return true
}

/**
 * Bucket mode: skip batch content-architect LLM (Groq 413 / TPM storms).
 * Zone already has Neon headlines; mechanical polish from card £/kg is enough locally.
 * Set ALLOW_CONTENT_ARCHITECT_LLM=1 to opt back into Gemini/Groq batch polish.
 */
export function shouldSkipContentArchitectLlm(): boolean {
  if (!isBucketFailoverMode()) return false
  const allow = process.env.ALLOW_CONTENT_ARCHITECT_LLM?.trim().toLowerCase() ?? ''
  if (allow === '1' || allow === 'true' || allow === 'yes') return false
  return true
}

export type SurgicalScrapeContext = {
  postcode: string
  journeyKey: string | null
  hasProfileAnchor: boolean
}

/** Any configured LLM for research/chat (Groq/Mistral/OpenRouter and/or non-skipped Gemini). */
export function hasAnyResearchLlmProvider(): boolean {
  if (process.env.GROQ_API_KEY?.trim()) return true
  if (process.env.MISTRAL_API_KEY?.trim()) return true
  if (process.env.OPENROUTER_API_KEY?.trim()) return true
  if (process.env.GEMINI_API_KEY?.trim() && !shouldSkipGeminiInBucket()) return true
  return false
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
  preferMechanicalTriplet: boolean
  providers: { gemini: boolean; groq: boolean; mistral: boolean; openrouter: boolean }
} {
  return {
    enabled: isBucketFailoverMode(),
    maxIterations: resolveMaxIterations(),
    broadScrapeAllowed: isBroadResearchAllowed(),
    skipDeepGemini: shouldSkipDeepGeminiSearch(),
    preferMechanicalTriplet: shouldPreferMechanicalTripletInBucket(),
    providers: {
      gemini:
        Boolean(process.env.GEMINI_API_KEY?.trim()) && !shouldSkipGeminiInBucket(),
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      mistral: Boolean(process.env.MISTRAL_API_KEY?.trim()),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    },
  }
}
