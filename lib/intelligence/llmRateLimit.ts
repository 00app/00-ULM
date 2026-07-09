/**
 * In-process provider cooldown after HTTP 429 / quota errors.
 * Dev server + serverless warm instances share one map per isolate.
 */

import type { BucketProviderId } from '@/lib/intelligence/bucketFailover'

const cooldownUntil = new Map<string, number>()

/** Parse Groq/OpenAI-style "Please try again in 14.42s" from error text. */
export function parseRetryAfterMs(message: string): number | null {
  const m = message.match(/try again in\s+([\d.]+)\s*s/i)
  if (!m?.[1]) return null
  const sec = parseFloat(m[1])
  if (!Number.isFinite(sec) || sec <= 0) return null
  return Math.ceil(sec * 1000) + 250
}

export function isRateLimitError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return /429|rate.?limit|tokens per minute|tpm|quota|resource.?exhausted/.test(msg)
}

export function markProviderCooldown(provider: BucketProviderId | string, ms: number): void {
  const key = String(provider).trim().toLowerCase()
  if (!key || ms <= 0) return
  const until = Date.now() + ms
  const prev = cooldownUntil.get(key) ?? 0
  cooldownUntil.set(key, Math.max(prev, until))
}

export function markProviderCooldownFromError(
  provider: BucketProviderId | string,
  err: unknown,
  fallbackMs = 20_000
): void {
  const msg = err instanceof Error ? err.message : String(err)
  const parsed = parseRetryAfterMs(msg)
  markProviderCooldown(provider, parsed ?? fallbackMs)
}

export function isProviderCoolingDown(provider: BucketProviderId | string): boolean {
  const key = String(provider).trim().toLowerCase()
  const until = cooldownUntil.get(key)
  if (!until) return false
  if (Date.now() >= until) {
    cooldownUntil.delete(key)
    return false
  }
  return true
}

export function isAnyProviderCoolingDown(providers: readonly string[]): boolean {
  return providers.some((p) => isProviderCoolingDown(p))
}

/** True only when every listed provider is cooling down — i.e. genuinely nothing left to try. */
export function isAllProvidersCoolingDown(providers: readonly string[]): boolean {
  return providers.every((p) => isProviderCoolingDown(p))
}

/**
 * Whether to skip LLM synthesis entirely rather than attempt the (bucket-failover) call.
 * Must require ALL configured providers to be cooling down, not any single one — this used to
 * check isAnyProviderCoolingDown, which meant one dead/invalid provider (e.g. an expired Gemini
 * key permanently on cooldown) silently blocked every other configured provider forever, even
 * ones that were perfectly healthy. generateWithBucketFailover already skips a cooling-down
 * provider and tries the next one internally — this check exists only to short-circuit when
 * there is truly nothing left to try, so it needs the same "all, not any" bar.
 */
export function isLlmRateLimited(providers?: readonly string[]): boolean {
  if (!providers?.length) {
    for (const until of cooldownUntil.values()) {
      if (Date.now() < until) return true
    }
    return false
  }
  return isAllProvidersCoolingDown(providers)
}

export async function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((r) => setTimeout(r, Math.min(ms, 60_000)))
}
