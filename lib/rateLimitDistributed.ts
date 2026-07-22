/**
 * Optional Upstash / Vercel KV fixed-window rate limit (survives serverless cold starts).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in production. Not required — if unset,
 * `checkRateLimitAsync` (lib/rateLimit.ts) falls back to the Neon-backed table in
 * `lib/rateLimitNeon.ts`, which needs no separate vendor since DATABASE_URL is already required.
 */
import { isDatabaseConfigured } from '@/lib/db'

const WINDOW_SEC = 60

type DistributedResult = { ok: boolean; retryAfter?: number }

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

/** Returns null when Upstash is not configured — caller should fall back to in-memory. */
export async function checkRateLimitDistributed(
  key: string,
  maxPerMinute: number
): Promise<DistributedResult | null> {
  if (!upstashConfigured()) return null

  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const redisKey = `rl:${key}`

  try {
    const pipeRes = await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['TTL', redisKey],
      ]),
      cache: 'no-store',
    })
    if (!pipeRes.ok) return null

    const pipeJson = (await pipeRes.json()) as { result?: [number, number] }
    const count = Number(pipeJson.result?.[0] ?? 1)
    let ttl = Number(pipeJson.result?.[1] ?? -1)

    if (ttl < 0) {
      await fetch(`${base}/expire/${encodeURIComponent(redisKey)}/${WINDOW_SEC}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      ttl = WINDOW_SEC
    }

    if (count > maxPerMinute) {
      return { ok: false, retryAfter: Math.max(1, ttl) }
    }
    return { ok: true }
  } catch {
    return null
  }
}

export function rateLimitBackendLabel(): 'upstash' | 'neon' | 'memory' {
  if (upstashConfigured()) return 'upstash'
  return isDatabaseConfigured() ? 'neon' : 'memory'
}
