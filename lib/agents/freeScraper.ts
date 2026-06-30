/**
 * Free scraper — plain fetch() + Readability + Turndown, no third-party API cost.
 * Covers the static, server-rendered UK gov/charity/comparison sites that make up most of our
 * seed URLs (gov.uk, Ofgem, MoneySavingExpert, EnergySavingTrust, etc.) — none of them need a
 * headless browser. Firecrawl stays as the fallback for whatever this can't reach.
 */

import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; ZeroZeroBot/1.0; +https://www.00-00.online) AppleWebKit/537.36'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

async function fetchOneUrlFree(
  url: string,
  minChars: number
): Promise<{ url: string; markdown: string; title?: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return null
    const html = await res.text()
    if (html.length < minChars) return null

    const dom = new JSDOM(html, { url })
    const article = new Readability(dom.window.document).parse()
    if (!article?.content) return null

    const markdown = turndown.turndown(article.content).trim()
    if (markdown.length < minChars) return null

    return { url, markdown, title: article.title || undefined }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Free-first batch fetch. Same return shape as fetchFirecrawlMarkdownForUrls so callers don't
 * need to change. `fallback` is called per-URL only for the ones the free fetch couldn't get
 * (blocked, JS-rendered, non-HTML, too short) — keeps Firecrawl spend to just the hard cases.
 */
export async function fetchMarkdownForUrlsFreeFirst(
  urls: string[],
  params: {
    minChars?: number
    maxUrls?: number
    fallback?: (
      urls: string[]
    ) => Promise<Array<{ url: string; markdown: string; title?: string }>>
  } = {}
): Promise<Array<{ url: string; markdown: string; title?: string }>> {
  const minChars = params.minChars ?? 120
  const maxUrls = Math.min(Math.max(1, params.maxUrls ?? urls.length), urls.length)
  const targetUrls = urls.slice(0, maxUrls)

  const freeResults = await Promise.all(targetUrls.map((url) => fetchOneUrlFree(url, minChars)))
  const out: Array<{ url: string; markdown: string; title?: string }> = []
  const missedUrls: string[] = []
  freeResults.forEach((result, i) => {
    if (result) out.push(result)
    else missedUrls.push(targetUrls[i])
  })

  if (missedUrls.length > 0 && params.fallback) {
    const fallbackResults = await params.fallback(missedUrls)
    out.push(...fallbackResults)
  }

  return out
}
