/**
 * Tavily — scrape backup, only invoked for URLs Firecrawl (or the free fetch path) couldn't
 * reach. Batches every missed URL into one `/extract` call: basic depth costs 1 credit per 5
 * URLs, so batching directly cuts spend vs one call per URL. Guarded by tavilyBudget so a busy
 * day can't exceed the free 1,000/month allowance.
 */
import { resolveTavilyApiKey } from '@/lib/sentinel/api-config'
import { reserveTavilyCredits } from '@/lib/intelligence/tavilyBudget'

const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract'
const TAVILY_BATCH_MAX = 20
const CREDITS_PER_URL_BLOCK = 5

export function hasTavilyApiKey(): boolean {
  return resolveTavilyApiKey().length > 0
}

type TavilyExtractResponse = {
  results?: Array<{ url: string; raw_content?: string }>
  failed_results?: Array<{ url: string; error?: string }>
}

/**
 * Extract markdown-ish raw content for URLs the primary scrapers missed.
 * Returns the same shape as `fetchFirecrawlMarkdownForUrls` so callers can drop it straight
 * into a fallback chain. Silently returns [] on missing key, denied budget, or API failure —
 * this is a backup tier, never the thing that should throw and break the caller.
 */
export async function fetchTavilyMarkdownForUrls(
  urls: string[],
  params?: { minChars?: number }
): Promise<Array<{ url: string; markdown: string; title?: string }>> {
  const apiKey = resolveTavilyApiKey()
  if (!apiKey || urls.length === 0) return []
  const minChars = params?.minChars ?? 120
  const batch = urls.slice(0, TAVILY_BATCH_MAX)

  const creditsNeeded = Math.ceil(batch.length / CREDITS_PER_URL_BLOCK)
  const allowed = await reserveTavilyCredits(creditsNeeded)
  if (!allowed) {
    console.warn('[tavilyScraper] monthly credit cap reached — skipping Tavily backup this call')
    return []
  }

  try {
    const res = await fetch(TAVILY_EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls: batch,
        extract_depth: 'basic',
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.warn(`[tavilyScraper] extract HTTP ${res.status}`)
      return []
    }
    const data = (await res.json()) as TavilyExtractResponse
    const out: Array<{ url: string; markdown: string; title?: string }> = []
    for (const r of data.results ?? []) {
      const content = (r.raw_content ?? '').trim()
      if (r.url && content.length >= minChars) {
        out.push({ url: r.url, markdown: content })
      }
    }
    return out
  } catch (e) {
    console.warn('[tavilyScraper] extract failed:', e)
    return []
  }
}
