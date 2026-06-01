/**
 * API bucket failover — Gemini Flash (primary) → Groq → Mistral → OpenRouter.
 * Enable with MODEL_STRATEGY=bucket_failover. Prefer free tiers; no Pro models.
 */

import {
  directModelForTier,
  GEMINI_PRECISION_TEMPERATURE,
  resolveGeminiTier,
  type GeminiModelTier,
} from '@/lib/intelligence/geminiModels'
import {
  isBucketFailoverMode,
  resolveMaxIterations,
  shouldSkipGeminiInBucket,
} from '@/lib/intelligence/scrapeBoundaries'
import {
  isProviderCoolingDown,
  isRateLimitError,
  markProviderCooldownFromError,
  parseRetryAfterMs,
  sleepMs,
} from '@/lib/intelligence/llmRateLimit'

export type BucketGenerateParams = {
  prompt: string
  tag?: string | null
  maxOutputTokens?: number
  temperature?: number
  tier?: GeminiModelTier
}

export type BucketProviderId = 'gemini' | 'groq' | 'mistral' | 'openrouter'

export type BucketGenerateResult = {
  text: string
  modelId: string
  viaGateway: boolean
  provider: BucketProviderId
  usedFallback: boolean
}

export function isBucketFailoverEnabled(): boolean {
  return isBucketFailoverMode()
}

function isFailoverEligible(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    /429|403|forbidden|dunning|quota|rate.?limit|resource.?exhausted|503|502|504|overload|credit|billing|spend|cap|unavailable|timeout|econnreset|fetch failed/.test(
      msg
    ) || msg.includes('gemini_api_key unset')
  )
}

async function chatCompletions(params: {
  url: string
  apiKey: string
  model: string
  prompt: string
  maxOutputTokens: number
  temperature: number
  referer?: string
}): Promise<string> {
  const res = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.referer ? { 'HTTP-Referer': params.referer } : {}),
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: 'user', content: params.prompt }],
      max_tokens: params.maxOutputTokens,
      temperature: params.temperature,
    }),
    signal: AbortSignal.timeout(55_000),
  })
  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`${params.url} HTTP ${res.status}: ${raw.slice(0, 280)}`)
  }
  let data: { choices?: Array<{ message?: { content?: string } }> }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    throw new Error(`Invalid JSON from ${params.url}`)
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (text.length < 1) throw new Error(`Empty completion from ${params.model}`)
  return text
}

async function generateGeminiBucket(
  params: BucketGenerateParams,
  tier: GeminiModelTier
): Promise<BucketGenerateResult> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('GEMINI_API_KEY unset')
  const modelName = directModelForTier(tier)
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
  if (text.length < 1) throw new Error(`Gemini empty response (${modelName})`)
  return {
    text,
    modelId: modelName,
    viaGateway: false,
    provider: 'gemini',
    usedFallback: false,
  }
}

async function generateGroqBucket(params: BucketGenerateParams): Promise<BucketGenerateResult> {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) throw new Error('GROQ_API_KEY unset')
  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.1-8b-instant'
  const text = await chatCompletions({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: key,
    model,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens ?? 768,
    temperature: params.temperature ?? GEMINI_PRECISION_TEMPERATURE,
  })
  return { text, modelId: model, viaGateway: false, provider: 'groq', usedFallback: true }
}

async function generateMistralBucket(params: BucketGenerateParams): Promise<BucketGenerateResult> {
  const key = process.env.MISTRAL_API_KEY?.trim()
  if (!key) throw new Error('MISTRAL_API_KEY unset')
  const model = process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest'
  const text = await chatCompletions({
    url: 'https://api.mistral.ai/v1/chat/completions',
    apiKey: key,
    model,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens ?? 1536,
    temperature: params.temperature ?? GEMINI_PRECISION_TEMPERATURE,
  })
  return { text, modelId: model, viaGateway: false, provider: 'mistral', usedFallback: true }
}

async function generateOpenRouterBucket(
  params: BucketGenerateParams
): Promise<BucketGenerateResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) throw new Error('OPENROUTER_API_KEY unset')
  const model =
    process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://00-ulm.vercel.app'
  const text = await chatCompletions({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: key,
    model,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens ?? 1536,
    temperature: params.temperature ?? GEMINI_PRECISION_TEMPERATURE,
    referer: appUrl,
  })
  return { text, modelId: model, viaGateway: false, provider: 'openrouter', usedFallback: true }
}

type BucketStep = {
  id: BucketProviderId
  run: (params: BucketGenerateParams, tier: GeminiModelTier) => Promise<BucketGenerateResult>
}

/** Order: Gemini primary unless BUCKET_SKIP_GEMINI / GEMINI_FREE_TIER — then Groq → Mistral → OpenRouter. */
function bucketSteps(): BucketStep[] {
  const steps: BucketStep[] = []
  if (!shouldSkipGeminiInBucket() && process.env.GEMINI_API_KEY?.trim()) {
    steps.push({ id: 'gemini', run: generateGeminiBucket })
  }
  if (process.env.GROQ_API_KEY?.trim()) {
    steps.push({ id: 'groq', run: (_p) => generateGroqBucket(_p) })
  }
  if (process.env.MISTRAL_API_KEY?.trim()) {
    steps.push({ id: 'mistral', run: (_p) => generateMistralBucket(_p) })
  }
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    steps.push({ id: 'openrouter', run: (_p) => generateOpenRouterBucket(_p) })
  }
  return steps
}

/**
 * Try providers in order until one succeeds or MAX_ITERATIONS attempts exhausted.
 * Respects per-provider cooldown after 429; skips immediate re-hit on the same provider.
 */
export async function generateWithBucketFailover(
  params: BucketGenerateParams
): Promise<BucketGenerateResult> {
  const tier = params.tier ?? resolveGeminiTier(params.tag)
  const steps = bucketSteps()
  if (steps.length === 0) {
    throw new Error(
      'bucket_failover: no providers configured (set GROQ_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, or enable Gemini)'
    )
  }
  const maxAttempts = Math.min(resolveMaxIterations(), steps.length)
  let lastErr: unknown = null
  let stepIndex = 0
  let rateLimitStreak = 0

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const step = steps[stepIndex % steps.length]!
    stepIndex += 1

    if (isProviderCoolingDown(step.id)) {
      if (steps.length === 1) {
        const waitMs = parseRetryAfterMs(
          lastErr instanceof Error ? lastErr.message : String(lastErr ?? '')
        )
        if (waitMs && rateLimitStreak < 1) {
          rateLimitStreak += 1
          await sleepMs(waitMs)
        } else {
          throw lastErr instanceof Error
            ? lastErr
            : new Error(`${step.id} cooling down — rate limit active`)
        }
      } else {
        continue
      }
    }

    try {
      const result = await step.run(params, tier)
      if (attempt > 0) {
        console.info(
          `[bucketFailover] recovered on ${result.provider} (${result.modelId}) after ${attempt} failover(s)`
        )
      }
      return result
    } catch (e) {
      lastErr = e
      const eligible = isFailoverEligible(e)
      if (isRateLimitError(e)) {
        markProviderCooldownFromError(step.id, e)
        rateLimitStreak += 1
      }
      if (eligible) {
        console.warn(
          `[bucketFailover] ${step.id} failed (attempt ${attempt + 1}/${maxAttempts}):`,
          e instanceof Error ? e.message.slice(0, 200) : e
        )
      } else {
        console.warn(
          `[bucketFailover] ${step.id} failed (attempt ${attempt + 1}/${maxAttempts}):`,
          e instanceof Error ? e.message.slice(0, 200) : e
        )
      }
      if (!eligible && attempt === 0 && steps.length === 1) break
      if (isRateLimitError(e) && steps.length === 1) break
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? 'bucket_failover: all providers failed'))
}

export function listConfiguredBucketProviders(): BucketProviderId[] {
  return bucketSteps().map((s) => s.id)
}

/** True when bucket_failover has at least one LLM provider (Groq/Mistral/OpenRouter and/or Gemini). */
export function hasAnyBucketLlmProvider(): boolean {
  return bucketSteps().length > 0
}
