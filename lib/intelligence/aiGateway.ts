/**
 * Vercel AI Gateway — unified generate path with model failover + domain tags.
 * Auth: AI_GATEWAY_API_KEY | VERCEL_AI_GATEWAY_API_KEY | AI_GATEWAY | VERCEL_OIDC_TOKEN
 * Falls back to direct @google/generative-ai when gateway is unset.
 *
 * Model split (May 2026): Flash-Lite = zone + chat; Flash = architect articles.
 * See `lib/intelligence/geminiModels.ts`.
 */

import { generateText, gateway } from 'ai'
import {
  generateWithBucketFailover,
  isBucketFailoverEnabled,
  listConfiguredBucketProviders,
} from '@/lib/intelligence/bucketFailover'
import {
  CHAT_GATEWAY_MODEL_CHAIN,
  directModelForTier,
  gatewayModelsForTier,
  GEMINI_GATEWAY_CHAT,
  GEMINI_PRECISION_TEMPERATURE,
  resolveGeminiTier,
  type GeminiModelTier,
  ZONE_GATEWAY_MODEL_CHAIN,
} from '@/lib/intelligence/geminiModels'

export { isBucketFailoverEnabled, listConfiguredBucketProviders } from '@/lib/intelligence/bucketFailover'
export {
  bucketFailoverStatus,
  isBucketFailoverMode,
  isBroadResearchAllowed,
  shouldSkipGeminiInBucket,
} from '@/lib/intelligence/scrapeBoundaries'

export {
  ARTICLE_GATEWAY_MODEL_CHAIN,
  CHAT_GATEWAY_MODEL_CHAIN,
  GEMINI_DIRECT_ARTICLE,
  GEMINI_DIRECT_CHAT,
  GEMINI_DIRECT_ZONE,
  GEMINI_GATEWAY_ARTICLE,
  GEMINI_GATEWAY_CHAT,
  GEMINI_GATEWAY_ZONE,
  RESEARCH_GATEWAY_MODEL_CHAIN,
  ZONE_GATEWAY_MODEL_CHAIN,
  EDITORIAL_MAGAZINE_CONSTRAINT,
  GEMINI_PRECISION_TEMPERATURE,
  directModelForTier,
  gatewayModelsForTier,
  resolveGeminiTier,
} from '@/lib/intelligence/geminiModels'

export type GatewayHealthSnapshot = {
  configured: boolean
  ok: boolean
  usingFallback: boolean
  lastModel: string | null
  lastError: string | null
  lastTag: string | null
  lastAt: string | null
}

const health: GatewayHealthSnapshot = {
  configured: false,
  ok: false,
  usingFallback: false,
  lastModel: null,
  lastError: null,
  lastTag: null,
  lastAt: null,
}

export function resolveAiGatewayApiKey(): string {
  for (const name of [
    'AI_GATEWAY_API_KEY',
    'VERCEL_AI_GATEWAY_API_KEY',
    'AI_GATEWAY',
  ] as const) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  return ''
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(resolveAiGatewayApiKey() || process.env.VERCEL_OIDC_TOKEN?.trim())
}

/** Explicit gateway API key (not OIDC-only) — Zone strip “AI GATEWAY” tick. */
export function hasAiGatewayApiKey(): boolean {
  return Boolean(resolveAiGatewayApiKey())
}

export function getGatewayHealthSnapshot(): GatewayHealthSnapshot {
  return { ...health, configured: isAiGatewayConfigured() }
}

function touchHealth(patch: Partial<GatewayHealthSnapshot>) {
  Object.assign(health, patch, { lastAt: new Date().toISOString(), configured: isAiGatewayConfigured() })
}

function normalizeGatewayTag(tag: string | null | undefined): string[] {
  const t = (tag ?? 'research').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  const base = t.length > 0 ? t : 'research'
  return [`domain:${base}`, 'zero-zero', 'hermes-research']
}

export type GatewayGenerateParams = {
  prompt: string
  /** Domain tag for AI Gateway dashboard (e.g. grants, solar, home). */
  tag?: string | null
  maxOutputTokens?: number
  temperature?: number
  /** Override failover chain for this call. */
  models?: string[]
  /** zone = cards/scrape; article = 3-paragraph prose; chat = Zai/iHints. */
  tier?: GeminiModelTier
}

/**
 * Research / scrape-sync — direct Gemini by default (no Vercel AI Gateway hop).
 * RESEARCH_FORCE_DIRECT_GEMINI=false re-enables gateway for research.
 */
export async function generateResearchText(params: GatewayGenerateParams): Promise<{
  text: string
  modelId: string
  viaGateway: boolean
}> {
  if (isBucketFailoverEnabled()) {
    const bucket = await generateWithBucketFailover(params)
    touchHealth({
      ok: bucket.text.length > 0,
      usingFallback: bucket.usedFallback,
      lastModel: `${bucket.provider}:${bucket.modelId}`,
      lastError: bucket.usedFallback ? `Recovered via ${bucket.provider}` : null,
      lastTag: params.tag ?? null,
    })
    return { text: bucket.text, modelId: bucket.modelId, viaGateway: bucket.viaGateway }
  }
  const tier = params.tier ?? resolveGeminiTier(params.tag)
  const forceDirect = process.env.RESEARCH_FORCE_DIRECT_GEMINI?.trim().toLowerCase() !== 'false'
  if (forceDirect) {
    return generateViaDirectGemini(params, directModelForTier(tier))
  }
  return generateGatewayText({ ...params, tier, models: params.models ?? gatewayModelsForTier(tier) })
}

/**
 * Vercel AI Gateway + failover — Ask Zai / iHints (Flash-Lite chain, no Pro).
 */
export async function generateGatewayText(params: GatewayGenerateParams): Promise<{
  text: string
  modelId: string
  viaGateway: boolean
}> {
  if (isBucketFailoverEnabled()) {
    const bucket = await generateWithBucketFailover(params)
    touchHealth({
      ok: bucket.text.length > 0,
      usingFallback: bucket.usedFallback,
      lastModel: `${bucket.provider}:${bucket.modelId}`,
      lastError: bucket.usedFallback ? `Recovered via ${bucket.provider}` : null,
      lastTag: params.tag ?? null,
    })
    return { text: bucket.text, modelId: bucket.modelId, viaGateway: bucket.viaGateway }
  }
  const tier = params.tier ?? resolveGeminiTier(params.tag)
  const models = (params.models?.length ? params.models : gatewayModelsForTier(tier)).filter(Boolean)
  const primary = models[0] ?? GEMINI_GATEWAY_CHAT
  const tags = normalizeGatewayTag(params.tag)

  if (!isAiGatewayConfigured()) {
    return generateViaDirectGemini(params, directModelForTier(tier))
  }

  let lastErr: unknown = null
  for (let i = 0; i < models.length; i++) {
    const modelId = models[i]!
    const fallbackModels = models.slice(i + 1)
    try {
      const result = await generateText({
        model: gateway(modelId),
        prompt: params.prompt,
        maxOutputTokens: params.maxOutputTokens ?? 1536,
        temperature: params.temperature ?? GEMINI_PRECISION_TEMPERATURE,
        headers: {
          'x-gateway-tag': tags[0] ?? 'research',
        },
        providerOptions: {
          gateway: {
            tags,
            ...(fallbackModels.length > 0 ? { models: fallbackModels } : {}),
          },
        },
      })
      const text = result.text?.trim() ?? ''
      touchHealth({
        ok: true,
        usingFallback: i > 0,
        lastModel: result.response?.modelId ?? modelId,
        lastError: i > 0 ? `Recovered on ${modelId}` : null,
        lastTag: tags[0] ?? null,
      })
      return { text, modelId: result.response?.modelId ?? modelId, viaGateway: true }
    } catch (e) {
      lastErr = e
      console.warn(
        `[aiGateway] model ${modelId} failed:`,
        e instanceof Error ? e.message : e
      )
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'gateway failed')
  touchHealth({
    ok: false,
    usingFallback: true,
    lastModel: primary,
    lastError: errMsg,
    lastTag: tags[0] ?? null,
  })

  try {
    return await generateViaDirectGemini(params, directModelForTier(tier))
  } catch (directErr) {
    touchHealth({
      ok: false,
      usingFallback: true,
      lastError: directErr instanceof Error ? directErr.message : String(directErr),
    })
    throw directErr
  }
}

async function generateViaDirectGemini(
  params: GatewayGenerateParams,
  directModel: string
): Promise<{ text: string; modelId: string; viaGateway: boolean }> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error('GEMINI_API_KEY unset and AI Gateway unavailable')
  }
  const modelName = directModel.trim() || directModelForTier(params.tier ?? resolveGeminiTier(params.tag))
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: params.maxOutputTokens ?? 1536,
      temperature: params.temperature ?? GEMINI_PRECISION_TEMPERATURE,
    },
  })
  const text = (await model.generateContent(params.prompt)).response.text()?.trim() ?? ''
  touchHealth({
    ok: text.length > 0,
    usingFallback: true,
    lastModel: `direct:${modelName}`,
    lastError: isAiGatewayConfigured() ? 'Gateway exhausted — direct Gemini' : null,
    lastTag: params.tag ?? null,
  })
  return { text, modelId: modelName, viaGateway: false }
}

/** Lightweight probe for /api/health/diagnostics (no user prompt). */
export async function probeAiGatewayConnection(): Promise<{
  ok: boolean
  configured: boolean
  usingFallback: boolean
  detail: string | null
}> {
  if (!isAiGatewayConfigured()) {
    return {
      ok: Boolean(process.env.GEMINI_API_KEY?.trim()),
      configured: false,
      usingFallback: true,
      detail: process.env.GEMINI_API_KEY?.trim()
        ? 'Gateway unset — direct GEMINI_API_KEY only'
        : 'AI Gateway and GEMINI_API_KEY unset',
    }
  }
  try {
    const { text } = await generateGatewayText({
      prompt: 'Reply with exactly: OK',
      tag: 'health-probe',
      maxOutputTokens: 8,
      temperature: 0,
      tier: 'chat',
      models: [GEMINI_GATEWAY_CHAT],
    })
    const ok = /^ok\b/i.test(text.trim())
    const snap = getGatewayHealthSnapshot()
    return {
      ok,
      configured: true,
      usingFallback: snap.usingFallback,
      detail: ok ? null : `Unexpected probe reply: ${text.slice(0, 40)}`,
    }
  } catch (e) {
    return {
      ok: false,
      configured: true,
      usingFallback: true,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
